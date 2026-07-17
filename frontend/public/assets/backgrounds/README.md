# CareQuest Background Assets

## Overview
Illustrated backgrounds for the CareQuest idle game, featuring **UGM campus locations** transformed into calming painted artwork.

## Background List (6 Harmony Ranks)

### 1. Rank 1: Struggling (0-99 Harmony)
- **UGM Location:** Library study area or exam hall
- **Filename:** `rank1-struggling.webp` or `.jpg`
- **Mood:** Tense, muted, cloudy
- **Colors:** Grays, muted blues, desaturated
- **Time:** Late evening, dim lighting
- **Atmosphere:** Pressure, stress, but not scary

### 2. Rank 2: Growing (100-499 Harmony)
- **UGM Location:** Classroom or lecture hall
- **Filename:** `rank2-growing.webp` or `.jpg`
- **Mood:** Hopeful, learning, dawn
- **Colors:** Warm oranges, yellows, soft browns
- **Time:** Early morning, sunrise
- **Atmosphere:** Beginning to improve, gentle encouragement

### 3. Rank 3: Balanced (500-1499 Harmony)
- **UGM Location:** Campus garden or courtyard
- **Filename:** `rank3-balanced.webp` or `.jpg`
- **Mood:** Peaceful, stable, clear
- **Colors:** Soft blues, greens, white
- **Time:** Mid-morning, clear sky
- **Atmosphere:** Equilibrium, calm, centered

### 4. Rank 4: Thriving (1500-4999 Harmony)
- **UGM Location:** Iconic building (Balairung, monuments)
- **Filename:** `rank4-thriving.webp` or `.jpg`
- **Mood:** Energetic, proud, vibrant
- **Colors:** Teals, purples, vibrant but soft
- **Time:** Afternoon, bright sunshine
- **Atmosphere:** Achievement, growth, pride

### 5. Rank 5: Flourishing (5000-14999 Harmony)
- **UGM Location:** Beautiful green spaces, trees
- **Filename:** `rank5-flourishing.webp` or `.jpg`
- **Mood:** Joyful, abundant, golden
- **Colors:** Golden yellows, pinks, warm
- **Time:** Golden hour, sunset
- **Atmosphere:** Thriving, joy, celebration

### 6. Rank 6: Masterful (15000+ Harmony)
- **UGM Location:** UGM main gate or panoramic campus view
- **Filename:** `rank6-masterful.webp` or `.jpg`
- **Mood:** Transcendent, magical, peaceful
- **Colors:** Deep purples, cyan, stars
- **Time:** Night with aurora/stars (artistic liberty)
- **Atmosphere:** Mastery, wisdom, serenity

---

## Technical Specifications

- **Format:** JPG or WebP (for web optimization)
- **Resolution:** 1920x1080px (Full HD)
- **Aspect Ratio:** 16:9 (horizontal)
- **Style:** Soft watercolor/digital painting illustration
- **File Size:** Aim for <200KB per background (after compression)
- **Optimization:** Use TinyPNG or Squoosh before deployment

---

## DALL-E 3 Transformation Workflow

### Step 1: Capture UGM Photos
1. Visit the UGM locations listed above
2. Take horizontal photos (16:9 ratio preferred)
3. Good lighting (golden hour is best)
4. Minimal people in frame
5. Clear view of recognizable landmarks

### Step 2: Upload to ChatGPT Plus
1. Open ChatGPT (requires ChatGPT Plus for DALL-E 3)
2. Upload your UGM photo
3. Use the transformation prompts below

### Step 3: Transformation Prompts

**Base Prompt Template:**
```
Transform this photo into a [style] painting, [mood] atmosphere with [colors], gentle and calming for mental health wellness game, maintain recognizable architecture, horizontal game background suitable for idle clicker game, dreamy and peaceful mood
```

**Specific Prompts by Rank:**

**Rank 1 (Struggling):**
```
Transform this UGM campus photo into a soft watercolor painting, tense melancholic atmosphere with muted blues and grays, late evening lighting with clouds, gentle and calming despite the stress theme, maintain recognizable architecture, horizontal game background, dreamy style for mental health game
```

**Rank 2 (Growing):**
```
Transform this UGM campus photo into a soft watercolor painting, hopeful dawn atmosphere with warm oranges and yellows, early morning sunrise lighting, gentle and encouraging mood, maintain recognizable buildings, horizontal game background, dreamy style for mental health wellness game
```

**Rank 3 (Balanced):**
```
Transform this UGM campus photo into a soft watercolor painting, peaceful balanced atmosphere with soft blues and greens, clear morning sky with fluffy clouds, calm and centered mood, maintain recognizable landmarks, horizontal game background, serene style for mental health game
```

**Rank 4 (Thriving):**
```
Transform this UGM campus photo into a soft watercolor painting, vibrant thriving atmosphere with teals and purples, bright afternoon sunshine, energetic yet peaceful mood, maintain recognizable architecture, horizontal game background, painterly style for mental health wellness game
```

**Rank 5 (Flourishing):**
```
Transform this UGM campus photo into a soft watercolor painting, joyful golden hour atmosphere with golden yellows and soft pinks, sunset lighting with warm glow, abundant and celebratory mood, maintain recognizable buildings, horizontal game background, dreamy style for mental health game
```

**Rank 6 (Masterful):**
```
Transform this UGM campus photo into a soft watercolor painting, transcendent magical atmosphere with deep purples and cyan, twilight or night sky with subtle aurora or stars, serene and wise mood, maintain recognizable landmarks, horizontal game background, ethereal painterly style for mental health wellness game
```

---

## Alternative Styles (If Watercolor Doesn't Work)

### Studio Ghibli Style:
```
Transform this UGM campus photo into Studio Ghibli anime background painting style, [mood and colors from rank], nostalgic and warm atmosphere, highly detailed painted background for game, maintain architecture, horizontal game background
```

### Digital Concept Art:
```
Transform this UGM campus photo into digital concept art painting for video game, soft atmospheric lighting, [mood and colors], painterly brush strokes, calming aesthetic for mental health game, maintain recognizable buildings
```

---

## Post-Processing Steps

1. **Download** generated image from ChatGPT
2. **Crop/Resize** to 1920x1080px
   - Use Photopea: https://photopea.com (free Photoshop alternative)
   - Or Canva: https://canva.com
3. **Color Adjustments** (if needed)
   - Match game palette colors
   - Adjust brightness/contrast for readability
4. **Optimize File Size**
   - TinyPNG: https://tinypng.com (compress without quality loss)
   - Squoosh: https://squoosh.app (convert to WebP)
5. **Save** with naming convention: `rank[number]-[name].webp`

---

## Integration with Game Code

After generating backgrounds, update `frontend/src/app/carequest/(hub)/page.tsx`:

```typescript
// Add to top of file
const RANK_BACKGROUNDS = [
  '/assets/backgrounds/rank1-struggling.webp',
  '/assets/backgrounds/rank2-growing.webp',
  '/assets/backgrounds/rank3-balanced.webp',
  '/assets/backgrounds/rank4-thriving.webp',
  '/assets/backgrounds/rank5-flourishing.webp',
  '/assets/backgrounds/rank6-masterful.webp',
];

// Inside component, get current rank background
const currentRank = getCurrentRank(gameState.harmony);
const bgImage = RANK_BACKGROUNDS[currentRank.level - 1];

// Apply to main container
<div 
  className="min-h-screen bg-cover bg-center bg-fixed"
  style={{ backgroundImage: `url(${bgImage})` }}
>
  {/* Game content */}
</div>
```

---

## Notes

- **Cultural Authenticity:** UGM students will recognize these locations, creating emotional connection
- **Mental Health Theme:** Each rank's atmosphere mirrors the mental health journey from struggle to mastery
- **Performance:** Optimize images to <200KB each for fast loading
- **Accessibility:** Ensure text remains readable against backgrounds (use semi-transparent overlays if needed)
- **Fallback:** If photo transformation doesn't work well, DALL-E can generate "inspired by Indonesian university campus" without photo upload

---

## Quick Start Checklist

- [ ] Take photos of 6 UGM locations
- [ ] Upload each photo to ChatGPT Plus
- [ ] Use rank-specific prompts above
- [ ] Download generated backgrounds
- [ ] Resize to 1920x1080px
- [ ] Optimize with TinyPNG/Squoosh
- [ ] Save to this directory with naming convention
- [ ] Update page.tsx with background integration code
- [ ] Test in game for readability and performance

---

**Generated:** October 26, 2025  
**Game:** UGM-AICare CareQuest Idle Clicker  
**Purpose:** Mental health awareness through gamification with Indonesian cultural context
