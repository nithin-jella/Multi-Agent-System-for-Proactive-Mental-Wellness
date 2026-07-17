# Monster Sprites for CareQuest Idle Clicker

This directory contains monster and boss sprites for the CareQuest game.

## Monster Types (Common)
- **Anxiety Goblin** - `anxiety-goblin.png`
- **Stress Slime** - `stress-slime.png`
- **Burnout Beast** - `burnout-beast.png`
- **Procrastination Imp** - `procrastination-imp.png`
- **Loneliness Wraith** - `loneliness-wraith.png`

## Boss Types
- **Exam Week Demon** - `exam-week-demon.png`
- **Thesis Dragon** - `thesis-dragon.png`
- **Social Pressure Titan** - `social-pressure-titan.png`
- **Perfectionism Hydra** - `perfectionism-hydra.png`
- **Imposter Syndrome Leviathan** - `imposter-syndrome-leviathan.png`

## Specifications
- **Format:** PNG with transparency
- **Size:** 256x256px (or 512x512px for higher quality)
- **Style:** Cute/friendly pixel art or cartoon style (not scary)
- **Color Palette:** Soft colors matching the mental health theme
  - Anxiety: Blue/purple tones
  - Stress: Green/yellow tones
  - Burnout: Orange/red tones
  - Loneliness: Gray/blue tones
  - Bosses: More vibrant, multi-colored

## Generation Options

### Option 1: AI Image Generation (Recommended)
Use tools like:
- **DALL-E 3** (via ChatGPT Plus)
- **Midjourney**
- **Stable Diffusion** (free, local)
- **Leonardo.ai** (free tier available)

### Option 2: Game Asset Marketplaces
- **itch.io** - Free game assets
- **OpenGameArt.org** - CC0 licensed art
- **Kenney.nl** - Free game assets

### Option 3: Commission an Artist
- **Fiverr** - Affordable pixel artists
- **ArtStation** - Professional game artists

### Option 4: Use Emoji/Unicode (Temporary)
Currently using text icons like "Monster", "Boss", etc.
Can upgrade to proper sprites later.

## Prompts for AI Generation

### Anxiety Goblin
```
A cute, small goblin character representing anxiety, pixel art style, 
blue-purple color scheme, worried expression, soft edges, transparent background, 
256x256px, game sprite, friendly not scary, mental health theme
```

### Stress Slime
```
A blob-like slime creature representing stress, pixel art style,
green-yellow color scheme, tired expression, melting appearance,
transparent background, 256x256px, game sprite, cute and friendly
```

### Burnout Beast
```
A tired wolf/beast creature representing burnout, pixel art style,
orange-red color scheme, exhausted expression, slouched posture,
transparent background, 256x256px, game sprite, sympathetic appearance
```

### Exam Week Demon (Boss)
```
A larger demon boss character representing exam stress, pixel art style,
vibrant red-purple colors, intense but not scary, holding papers/books,
transparent background, 512x512px, game boss sprite, stylized and cartoony
```

### Thesis Dragon (Boss)
```
A dragon boss made of papers and books, pixel art style,
blue-purple gradient colors, surrounded by floating papers,
transparent background, 512x512px, game boss sprite, academic theme,
friendly dragon face but imposing size
```

## Current Implementation
Currently using text labels as placeholders:
- Common monsters show icon name as text
- Bosses show "Boss" badge
- Will be replaced with actual sprite images when available

## Integration
Once sprites are ready, update `constants.ts` to use image paths:
```typescript
icon: '/assets/monsters/anxiety-goblin.png'
```

Then update `MonsterDisplay.tsx` to render images instead of text:
```tsx
<Image 
  src={monster.icon} 
  alt={monster.name} 
  width={256} 
  height={256} 
/>
```
