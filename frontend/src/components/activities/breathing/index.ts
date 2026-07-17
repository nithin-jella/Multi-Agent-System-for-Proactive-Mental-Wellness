/**
 * Breathing Activities Export
 * 
 * This file auto-exports all breathing activities for registration.
 * Add new breathing activities here to make them available system-wide.
 */

import type { ActivityMetadata } from '../types';

export { default as BoxBreathing } from './BoxBreathing';
export { default as FourSevenEight } from './FourSevenEight';

// Activity metadata for the registry
export const breathingActivities: ActivityMetadata[] = [
  {
    id: 'box-breathing',
    name: 'Box Breathing',
    description: 'Equal-length breathing pattern to reduce stress and improve focus. Used by Navy SEALs.',
    category: 'breathing',
    estimatedDuration: 240,
    difficulty: 'beginner',
    tags: ['stress-relief', 'focus', 'calming', 'anxiety'],
    icon: '🔲',
    component: 'BoxBreathing',
  },
  {
    id: 'four-seven-eight',
    name: '4-7-8 Breathing',
    description: 'Dr. Andrew Weil\'s relaxing breath technique for sleep and anxiety management.',
    category: 'breathing',
    estimatedDuration: 300,
    difficulty: 'beginner',
    tags: ['sleep', 'relaxation', 'anxiety', 'calming'],
    icon: '💜',
    component: 'FourSevenEight',
  },
];
