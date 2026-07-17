/**
 * Grounding Activities Export
 *
 * This file exports all grounding activities for registration.
 * Grounding techniques help anchor users to the present moment.
 */

import type { ActivityMetadata } from '../types';

export { default as FiveFourThreeTwoOne } from './FiveFourThreeTwoOne';
export { default as ThreeThreeThree } from './ThreeThreeThree';

// Activity metadata for the registry
export const groundingActivities: ActivityMetadata[] = [
  {
    id: 'five-four-three-two-one',
    name: '5-4-3-2-1 Grounding',
    description: 'A sensory awareness technique that uses all five senses to anchor you to the present moment.',
    category: 'grounding',
    estimatedDuration: 180,
    difficulty: 'beginner',
    tags: ['anxiety', 'panic', 'present-moment', 'sensory'],
    icon: '🌿',
    component: 'FiveFourThreeTwoOne',
  },
  {
    id: 'three-three-three',
    name: '3-3-3 Grounding',
    description: 'A quick and easy technique to center yourself: name 3 things you see, 3 things you hear, and move 3 body parts.',
    category: 'grounding',
    estimatedDuration: 120,
    difficulty: 'beginner',
    tags: ['anxiety', 'grounding', 'focus', 'present-moment'],
    icon: '🧘‍♀️',
    component: 'ThreeThreeThree',
  },
];
