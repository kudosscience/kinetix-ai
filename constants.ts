import { ExerciseType, ExerciseConfig } from './types';

export const EXERCISES: ExerciseConfig[] = [
  {
    id: ExerciseType.SQUAT,
    name: 'Bodyweight Squat',
    description: 'Stand feet shoulder-width apart. Lower hips back and down.',
    keyPoints: ['Keep back straight', 'Knees behind toes', 'Chest up', 'Thighs parallel to floor'],
    thumbnail: 'https://picsum.photos/400/300?grayscale',
  },
  {
    id: ExerciseType.ARM_RAISES,
    name: 'Lateral Arm Raises',
    description: 'Raise arms to the side until shoulder height.',
    keyPoints: ['Keep core tight', 'Don\'t shrug shoulders', 'Control the descent', 'Arms straight but not locked'],
    thumbnail: 'https://picsum.photos/401/300?grayscale',
  },
  {
    id: ExerciseType.LUNGES,
    name: 'Forward Lunges',
    description: 'Step forward with one leg, lowering your hips.',
    keyPoints: ['Back straight', 'Both knees at 90 degrees', 'Front knee over ankle'],
    thumbnail: 'https://picsum.photos/402/300?grayscale',
  },
];

export const MODEL_NAME = 'gemini-2.5-flash-native-audio-preview-12-2025';

export const SYSTEM_INSTRUCTION = (exerciseName: string, keyPoints: string[]) => `
You are Kinetix, an expert biomechanics and physical therapy AI assistant. 
The user is performing: ${exerciseName}.
Key form points to watch: ${keyPoints.join(', ')}.

Your Goal:
1. Observe the user via video.
2. Listen to the user's questions via audio.
3. Provide concise, encouraging, real-time feedback via AUDIO.
4. Count the repetitions out loud (e.g., "One, good form.", "Two, go lower.").
5. If form is incorrect, gently correct it (e.g., "Keep your back straighter", "Don't let knees cave in").

IMPORTANT SAFETY:
- You are NOT a doctor. Do not provide medical diagnosis.
- If the user mentions sharp pain, tell them to stop immediately.
- Focus strictly on form efficiency and safety mechanics.
- Keep responses short and spoken quickly to match the movement pace.
`;
