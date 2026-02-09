export enum ExerciseType {
  SQUAT = 'Squat',
  LUNGES = 'Lunges',
  ARM_RAISES = 'Lateral Arm Raises',
  PLANK = 'Plank',
}

export interface ExerciseConfig {
  id: ExerciseType;
  name: string;
  description: string;
  keyPoints: string[];
  thumbnail: string;
}

export interface SessionStats {
  durationSeconds: number;
  repsCounted: number;
  correctionsGiven: number;
  formScore: number; // 0-100
}

export interface LiveState {
  isConnected: boolean;
  isStreaming: boolean;
  volume: number;
  transcript: string;
}
