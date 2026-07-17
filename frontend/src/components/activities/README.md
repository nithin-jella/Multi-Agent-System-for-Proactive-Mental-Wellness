# Therapeutic Activities System

Interactive therapeutic activities for mental wellness, integrated with the TCA (Therapeutic Coach Agent) intervention plans.

## 🚀 Quick Start for Contributors

**Want to add a new activity?** Follow these 3 simple steps:

1. **Create** your component in the appropriate category folder
2. **Export** it from the category's `index.ts`  
3. **Add metadata** to the category's activities array

That's it! The registry auto-discovers activities from category exports.

---

## 📁 Architecture

```
activities/
├── README.md                    # You're reading this!
├── index.ts                     # Main exports for external use
├── registry.ts                  # Activity registry & discovery
├── types.ts                     # Shared TypeScript types
├── ActivityPlayer.tsx           # Renders any activity by ID
├── ActivityBrowser.tsx          # Browse & select activities
│
├── breathing/                   # ✅ Breathing exercises
│   ├── index.ts                 # Exports + metadata
│   ├── BoxBreathing.tsx         # ✅ 4-4-4-4 technique
│   └── FourSevenEight.tsx       # ✅ 4-7-8 technique
│
├── grounding/                   # ✅ Grounding techniques  
│   ├── index.ts                 # Exports + metadata
│   └── FiveFourThreeTwoOne.tsx  # ✅ 5-4-3-2-1 senses
│
├── mindfulness/                 # 🔲 Coming soon
├── cognitive/                   # 🔲 Coming soon
└── shared/                      # 🔲 Shared utilities
```

---

## 📝 Step-by-Step: Adding a New Activity

### Step 1: Create Your Component

Create a file in the appropriate category (e.g., `breathing/DiaphragmaticBreathing.tsx`):

```tsx
'use client';

import { useState } from 'react';
import { ActivityProps, ActivityResult } from '../types';

export default function DiaphragmaticBreathing({ 
  onComplete, 
  onProgress, 
  onExit,
  config,
  userPreferences 
}: ActivityProps) {
  const [isActive, setIsActive] = useState(false);
  
  const handleComplete = () => {
    const result: ActivityResult = {
      activityId: 'diaphragmatic-breathing',
      completedAt: new Date().toISOString(),
      duration: 180, // seconds taken
      completed: true,
      metrics: {
        breathCycles: 6,
      },
    };
    onComplete?.(result);
  };

  return (
    <div className="p-6 bg-gradient-to-br from-blue-900 to-cyan-900 rounded-3xl">
      <h2 className="text-2xl font-bold text-white">Diaphragmatic Breathing</h2>
      {/* Your activity UI here */}
      <button onClick={handleComplete}>Complete</button>
      <button onClick={onExit}>Exit</button>
    </div>
  );
}
```

### Step 2: Export from Category Index

Update `breathing/index.ts`:

```typescript
// Add your export
export { default as DiaphragmaticBreathing } from './DiaphragmaticBreathing';

// Add to the metadata array
export const breathingActivities = [
  // ... existing activities
  {
    id: 'diaphragmatic-breathing',
    name: 'Diaphragmatic Breathing',
    description: 'Deep belly breathing for relaxation',
    category: 'breathing',
    estimatedDuration: 180,
    difficulty: 'beginner',
    tags: ['relaxation', 'stress-relief', 'deep-breathing'],
    icon: '🫁',
    component: 'DiaphragmaticBreathing',
  },
];
```

### Step 3: Register in ActivityPlayer

Add lazy import in `ActivityPlayer.tsx`:

```typescript
const activityComponents = {
  // ... existing
  'diaphragmatic-breathing': lazy(() => import('./breathing/DiaphragmaticBreathing')),
};
```

### Step 4: Import in Registry

Update `registry.ts` to import your category's activities (already done for existing categories).

**Done!** Your activity is now discoverable and playable.

---

## 🔧 TypeScript Interfaces

### ActivityProps (received by your component)

```typescript
interface ActivityProps {
  onComplete?: (result: ActivityResult) => void;  // Call when done
  onProgress?: (progress: number) => void;        // Report 0-100%
  onExit?: () => void;                            // User exits early
  config?: ActivityConfig;                        // Duration, difficulty
  userPreferences?: UserPreferences;              // Sound, motion prefs
}
```

### ActivityResult (returned on completion)

```typescript
interface ActivityResult {
  activityId: string;
  completedAt: string;        // ISO timestamp
  duration: number;           // Actual seconds taken
  completed: boolean;         // Finished or exited early?
  metrics?: Record<string, number | string | boolean>;
  feedback?: {
    rating?: number;          // 1-5 stars
    notes?: string;
  };
}
```

### ActivityMetadata (for registry)

```typescript
interface ActivityMetadata {
  id: string;                                      // Unique ID
  name: string;                                    // Display name
  description: string;                             // Short description
  category: 'breathing' | 'grounding' | 'mindfulness' | 'cognitive';
  estimatedDuration: number;                       // Seconds
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  tags: string[];                                  // For search/filter
  icon: string;                                    // Emoji
  component: string;                               // Component name
}
```

---

## ✅ Best Practices

| Practice | Why |
|----------|-----|
| **Report progress** | Users need to know how far along they are |
| **Allow early exit** | Always let users quit without judgment |
| **Respect `reducedMotion`** | Some users have motion sensitivity |
| **Accessible colors** | Ensure sufficient contrast |
| **Mobile-first** | Design for touch, 320px+ screens |
| **Offline-ready** | Activities should work without network |

### Animation Guidelines

```tsx
// Check user preferences
const reducedMotion = userPreferences?.reducedMotion ?? false;

// Conditional animation
<motion.div
  animate={{
    scale: reducedMotion ? 1 : breathingScale,
  }}
  transition={{
    duration: reducedMotion ? 0 : 0.5,
  }}
/>
```

---

## 📊 Categories

| Category | Purpose | Example Activities |
|----------|---------|-------------------|
| `breathing` | Breathing exercises | Box Breathing, 4-7-8 |
| `grounding` | Present-moment awareness | 5-4-3-2-1 Senses |
| `mindfulness` | Meditation & relaxation | Body Scan, PMR |
| `cognitive` | Thought-based exercises | Gratitude Journal |

---

## 🤖 TCA Integration

The TCA (Therapeutic Coach Agent) recommends activities based on:
- User's current emotional state
- Risk assessment from STA
- Activity history and preferences
- Time of day and context

Activities appear in intervention plans:

```json
{
  "plan_steps": ["Acknowledge feelings", "Suggest coping"],
  "resource_cards": [
    {
      "type": "activity",
      "activity_id": "box-breathing",
      "title": "Box Breathing",
      "description": "A calming 4-4-4-4 breathing technique"
    }
  ]
}
```

---

## 🎯 Usage Examples

### Play a specific activity

```tsx
import { ActivityPlayer } from '@/components/activities';

<ActivityPlayer
  activityId="box-breathing"
  onComplete={(result) => console.log('Done!', result)}
  onExit={() => router.back()}
/>
```

### Browse all activities

```tsx
import { ActivityBrowser } from '@/components/activities';

<ActivityBrowser
  onSelect={(activity) => setSelected(activity.id)}
  filterCategory="breathing"
/>
```

### Get recommendations

```tsx
import { activityRegistry } from '@/components/activities';

// Get activities for anxious users
const recommendations = activityRegistry.getRecommendations(['anxiety']);

// Search by keyword
const results = activityRegistry.search('breathing');

// Filter by tags
const calmingActivities = activityRegistry.getByTags(['calming', 'relaxation']);
```

---

## 🆘 Need Help?

- Check existing activities for patterns
- TypeScript will guide you through the interfaces
- Test on mobile and desktop
- Accessibility: tab navigation should work
