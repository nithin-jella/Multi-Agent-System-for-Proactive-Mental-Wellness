import type { ActivityMetadata } from '../types';

export { default as BodyScan } from './BodyScan';

export const mindfulnessActivities: ActivityMetadata[] = [
  {
    id: 'body-scan',
    name: 'Body Scan Meditation',
    description: 'A guided body-awareness practice to reduce tension and bring attention to the present moment.',
    category: 'mindfulness',
    estimatedDuration: 300,
    difficulty: 'beginner',
    tags: ['mindfulness', 'relaxation', 'focus', 'stress-relief'],
    icon: '🧘',
    component: 'BodyScan',
  },
];
