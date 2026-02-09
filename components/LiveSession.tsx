import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { ExerciseConfig } from '../types';
import { MODEL_NAME, SYSTEM_INSTRUCTION } from '../constants';
import { blobToBase64, decodeAudioData, pcmToGeminiBlob, base64ToUint8Array } from '../utils/audio-utils';

interface LiveSessionProps {
  exercise: ExerciseConfig;
  onEndSession: () => void;
}

const LiveSession: React.FC<LiveSessionProps> = ({ exercise, onEndSession }) => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [micActive, setMicActive] = useState(true);
  const [cameraActive, setCameraActive] = useState(true);
  const [latestTranscript, setLatestTranscript] = useState<string>('');
  
  // Refs for Media & Gemini
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(document.createElement('canvas')); // For Gemini Screenshots
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null); // For Skeletal Overlay
  const streamRef = useRef<MediaStream | null>(null);
  const sessionRef = useRef<any>(null);
  
  // Refs for Audio Processing
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioInputContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  
  // Refs for intervals & animation frames
  const videoIntervalRef = useRef<number | null>(null);
  const requestAnimationFrameRef = useRef<number | null>(null);
  const poseRef = useRef<any>(null);

  const startSession = async () => {
    setIsConnecting(true);

    try {
      // 1. Setup Gemini Client
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      // 2. Setup Audio Contexts
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = audioCtx;
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioInputContextRef.current = inputCtx;

      // 3. Get Media Stream (Camera + Mic)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000
        } 
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        // Wait for metadata to load to get dimensions for canvas
        await new Promise((resolve) => {
            videoRef.current!.onloadedmetadata = () => {
                resolve(true);
            };
        });
        await videoRef.current.play();
        
        // Initialize MediaPipe after video is ready
        await initMediaPipe();
      }

      // 4. Connect to Gemini Live
      const sessionPromise = ai.live.connect({
        model: MODEL_NAME,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION(exercise.name, exercise.keyPoints),
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
          outputAudioTranscription: {},
          speechConfig: {
             voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } }
          }
        },
        callbacks: {
          onopen: () => {
            console.log("Gemini Live Session Opened");
            setIsConnected(true);
            setIsConnecting(false);
            
            const source = inputCtx.createMediaStreamSource(stream);
            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
              if (!micActive) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = pcmToGeminiBlob(inputData, 16000);
              sessionPromise.then(session => {
                  session.sendRealtimeInput({ media: pcmBlob });
              });
            };
            
            source.connect(processor);
            processor.connect(inputCtx.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
             if (msg.serverContent?.outputTranscription) {
                setLatestTranscript(msg.serverContent.outputTranscription.text);
             }

             const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
             if (audioData) {
               const ctx = audioContextRef.current;
               if (!ctx) return;
               
               nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
               
               const audioBuffer = await decodeAudioData(
                 base64ToUint8Array(audioData),
                 ctx,
                 24000,
                 1
               );

               const source = ctx.createBufferSource();
               source.buffer = audioBuffer;
               source.connect(ctx.destination);
               source.start(nextStartTimeRef.current);
               nextStartTimeRef.current += audioBuffer.duration;
               
               audioSourcesRef.current.add(source);
               source.onended = () => {
                 audioSourcesRef.current.delete(source);
               };
             }
          },
          onclose: () => {
            console.log("Session Closed");
            setIsConnected(false);
          },
          onerror: (err) => {
            console.error("Session Error", err);
          }
        }
      });
      
      const session = await sessionPromise;
      sessionRef.current = session;

      // 5. Start Gemini Vision Stream (Low FPS)
      startGeminiVisionLoop(session);

    } catch (err) {
      console.error("Failed to start session:", err);
      setIsConnecting(false);
    }
  };

  const initMediaPipe = async () => {
    if (!videoRef.current || !overlayCanvasRef.current) return;
    
    // Globals loaded via CDN in index.html
    const Pose = (window as any).Pose;
    const drawingUtils = (window as any);
    
    if (!Pose) {
        console.error("MediaPipe Pose not loaded");
        return;
    }

    const pose = new Pose({locateFile: (file: string) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }});

    pose.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    });

    pose.onResults((results: any) => {
       const canvas = overlayCanvasRef.current;
       const video = videoRef.current;
       if (!canvas || !video) return;

       const ctx = canvas.getContext('2d');
       if (!ctx) return;

       // Match canvas size to video size
       canvas.width = video.videoWidth;
       canvas.height = video.videoHeight;

       ctx.save();
       ctx.clearRect(0, 0, canvas.width, canvas.height);
       
       // Draw Connectors
       if (results.poseLandmarks) {
         drawingUtils.drawConnectors(ctx, results.poseLandmarks, drawingUtils.POSE_CONNECTIONS,
             {color: '#14b8a6', lineWidth: 4}); // Teal-500
         
         // Draw Landmarks
         drawingUtils.drawLandmarks(ctx, results.poseLandmarks,
             {color: '#f0f9ff', lineWidth: 2, radius: 4}); // Slate-50 with border
       }
       ctx.restore();
    });

    poseRef.current = pose;
    startMediaPipeLoop(pose);
  };

  const startMediaPipeLoop = (pose: any) => {
    const loop = async () => {
      if (videoRef.current && cameraActive) {
        await pose.send({image: videoRef.current});
      }
      requestAnimationFrameRef.current = requestAnimationFrame(loop);
    };
    loop();
  };

  const startGeminiVisionLoop = (session: any) => {
    // Send frames to Gemini at 2FPS
    videoIntervalRef.current = window.setInterval(async () => {
      if (!videoRef.current || !canvasRef.current || !cameraActive) return;
      
      const ctx = canvasRef.current.getContext('2d');
      const video = videoRef.current;
      if (!ctx) return;

      canvasRef.current.width = video.videoWidth * 0.5; 
      canvasRef.current.height = video.videoHeight * 0.5;
      
      ctx.drawImage(video, 0, 0, canvasRef.current.width, canvasRef.current.height);
      
      canvasRef.current.toBlob(async (blob) => {
        if (blob) {
            const base64Data = await blobToBase64(blob);
            session.sendRealtimeInput({
                media: {
                    mimeType: 'image/jpeg',
                    data: base64Data
                }
            });
        }
      }, 'image/jpeg', 0.6); 

    }, 500); 
  };

  const stopSession = useCallback(() => {
    if (videoIntervalRef.current) clearInterval(videoIntervalRef.current);
    if (requestAnimationFrameRef.current) cancelAnimationFrame(requestAnimationFrameRef.current);
    
    streamRef.current?.getTracks().forEach(t => t.stop());
    audioContextRef.current?.close();
    audioInputContextRef.current?.close();
    
    if (poseRef.current) {
        poseRef.current.close();
    }
    
    sessionRef.current = null;
    onEndSession();
  }, [onEndSession]);

  useEffect(() => {
    startSession();
    return () => {
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 bg-slate-900 flex flex-col z-50">
      {/* Header */}
      <div className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-900/90 backdrop-blur z-50">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-white font-mono text-sm tracking-wider font-bold">LIVE SESSION</span>
          </div>
          <div className="h-6 w-px bg-slate-700"></div>
          <span className="text-slate-300 font-medium">{exercise.name}</span>
        </div>
        <button 
          onClick={stopSession}
          className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-4 py-2 rounded-lg font-medium transition-colors text-sm"
        >
          End Session
        </button>
      </div>

      <div className="flex-1 relative flex">
        {/* Main Video Area */}
        <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
           {/* Wrapper to ensure Video and Overlay Canvas match perfectly */}
           <div className="relative w-full h-full flex items-center justify-center">
               <video 
                 ref={videoRef}
                 className="absolute w-full h-full object-cover transform scale-x-[-1]" 
                 muted 
                 playsInline
               />
               <canvas
                 ref={overlayCanvasRef}
                 className="absolute w-full h-full object-cover transform scale-x-[-1]"
               />
           </div>
           
           {/* Overlay - Loading State */}
           {(isConnecting) && (
             <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex flex-col items-center justify-center z-10">
                <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4"></div>
                <p className="text-white font-medium">Calibrating Kinetix AI...</p>
             </div>
           )}

           {/* Overlay - AI Feedback */}
           <div className="absolute bottom-8 left-8 right-8 z-20">
              <div className="bg-black/60 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-2xl">
                 <div className="flex items-start space-x-4">
                    <div className="w-10 h-10 rounded-full bg-teal-500/20 flex items-center justify-center border border-teal-500/30">
                        {/* Audio Waveform Icon */}
                        <div className="flex items-end space-x-0.5 h-4">
                            <div className="w-1 bg-teal-400 h-2 animate-pulse"></div>
                            <div className="w-1 bg-teal-400 h-4 animate-pulse delay-75"></div>
                            <div className="w-1 bg-teal-400 h-3 animate-pulse delay-100"></div>
                        </div>
                    </div>
                    <div className="flex-1">
                        <p className="text-teal-400 text-xs font-bold uppercase tracking-widest mb-1">AI Coach</p>
                        <p className="text-white text-lg font-medium leading-relaxed">
                           {latestTranscript || "I'm watching your form. Begin when ready..."}
                        </p>
                    </div>
                 </div>
              </div>
           </div>
        </div>

        {/* Sidebar Controls */}
        <div className="w-80 border-l border-slate-800 bg-slate-900 p-6 space-y-8 hidden md:block z-50">
            {/* Vision Status */}
            <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">System Status</h3>
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">Vision Stream</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${cameraActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                           {cameraActive ? 'ACTIVE' : 'PAUSED'}
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">Skeleton Tracking</span>
                        <span className="px-2 py-0.5 rounded text-xs bg-emerald-500/10 text-emerald-400">
                           ACTIVE
                        </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-300">Audio Input</span>
                        <span className={`px-2 py-0.5 rounded text-xs ${micActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                           {micActive ? 'LISTENING' : 'MUTED'}
                        </span>
                    </div>
                </div>
            </div>

            {/* Exercise Info */}
            <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">Focus Points</h3>
                <ul className="space-y-3">
                    {exercise.keyPoints.map((point, i) => (
                        <li key={i} className="flex items-start space-x-3 text-sm text-slate-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-2 shrink-0"></span>
                            <span>{point}</span>
                        </li>
                    ))}
                </ul>
            </div>

            {/* Controls */}
            <div className="pt-6 border-t border-slate-800">
                <button 
                  onClick={() => setMicActive(!micActive)}
                  className={`w-full py-3 rounded-lg font-medium transition-colors mb-3 flex items-center justify-center space-x-2 ${micActive ? 'bg-slate-800 text-white hover:bg-slate-700' : 'bg-red-500/20 text-red-400'}`}
                >
                   <span>{micActive ? 'Mute Microphone' : 'Unmute Microphone'}</span>
                </button>
                <div className="text-xs text-slate-500 text-center">
                    Speak naturally to ask for help. <br/>"Am I doing this right?"
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default LiveSession;