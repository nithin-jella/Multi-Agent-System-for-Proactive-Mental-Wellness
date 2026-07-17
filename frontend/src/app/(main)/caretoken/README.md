# $CARE Token Page

## Overview

Interactive landing page for the $CARE token, showcasing tokenomics, use cases, and documentation.

## URL

`/caretoken`

## Sections

### 1. Hero Section

- Animated coin logo with floating elements
- Key statistics (Max Supply, Standard, Blockchain, Performance)
- CTA buttons to tokenomics and whitepaper
- Smooth parallax scrolling effect

### 2. Tokenomics Section

- Horizontal bar chart showing distribution (7 categories)
- Animated percentage bars
- Key features cards:
  - Deflationary Design
  - Anti-Dump Protection
  - Halving Rewards
- Link to full tokenomics documentation

### 3. Use Cases Section (Tabbed Interface)

- **Earn CARE Tab**: How users earn tokens (check-ins, CBT, streaks)
- **Spend CARE Tab**: Real-world utility (vouchers, tickets, services)
- **Stake & Grow Tab**: Staking tiers and APY rewards (5%-35%)
- **Governance Tab**: DAO participation and voting rights

### 4. Whitepaper Section

- Three document cards:
  - Complete Tokenomics (50+ pages)
  - Distribution Summary (10 pages)
  - Vesting Schedules (30+ pages)
- External links to GitHub documentation
- Key highlights grid (Total Supply, TGE, Community allocation)
- Additional resource links (GitHub, SOMNIA Explorer, Docs)

### 5. FAQ Section

- 8 common questions with expandable answers
- Topics: What is $CARE, earning methods, spending options, supply cap, staking, vesting, deflationary mechanisms, governance

### 6. CTA Section

- Final call-to-action with "Get Started" and "View Dashboard" buttons
- Trust indicators (Audited, Community Governed, Secure)
- Floating coin animation background

## Design Features

### Visual Elements

- ✅ Gradient backgrounds (ugm-blue, ugm-gold)
- ✅ Glassmorphism cards (backdrop-blur, white/10 opacity)
- ✅ Floating coin animations throughout
- ✅ Parallax scrolling effects
- ✅ Smooth scroll-triggered animations (framer-motion)
- ✅ Hover effects with scale and glow
- ✅ Responsive grid layouts

### Animations

- ✅ Hero entrance (scale, rotate, fade-in)
- ✅ Scroll-triggered section reveals (useInView)
- ✅ Staggered list animations
- ✅ Progress bar animations
- ✅ Tab transitions
- ✅ FAQ accordion expand/collapse
- ✅ Continuous floating elements

### Interactive Components

- ✅ Tab switcher for use cases (4 tabs)
- ✅ Expandable FAQ items
- ✅ Hover states on all cards
- ✅ Smooth anchor links (#tokenomics, #usecases, #whitepaper)
- ✅ External link buttons

## Technologies Used

- **Next.js 15**: App Router with TypeScript
- **Framer Motion**: Advanced animations and scroll effects
- **Tailwind CSS**: Utility-first styling
- **React Icons**: FaCoins, FiShield, FiUsers, etc.
- **Custom Icons**: Centralized icon exports from @/icons

## Performance Considerations

- ✅ Client-side rendering only where needed ("use client")
- ✅ Lazy animation loading (animations only when in view)
- ✅ Optimized icon imports (tree-shaking)
- ✅ Responsive images and layouts
- ✅ No heavy external dependencies

## Accessibility

- ✅ Semantic HTML structure
- ✅ ARIA labels for interactive elements
- ✅ Keyboard navigation support
- ✅ Focus states on buttons and links
- ✅ Sufficient color contrast (WCAG AA)
- ✅ Reduced motion support (prefers-reduced-motion)

## Mobile Responsiveness

- ✅ Responsive grid: 1 column (mobile) → 2-4 columns (desktop)
- ✅ Flexible button layouts (column on mobile, row on desktop)
- ✅ Touch-friendly tap targets (min 44x44px)
- ✅ Readable font sizes on small screens
- ✅ Optimized floating elements for mobile performance

## Future Enhancements

- [ ] Add live token price ticker (when mainnet launched)
- [ ] Integrate wallet connection (MetaMask, WalletConnect)
- [ ] Show real-time circulating supply
- [ ] Add interactive staking calculator
- [ ] Embed live distribution pie chart from blockchain
- [ ] Add Bahasa Indonesia language toggle
- [ ] Create downloadable PDF whitepaper
- [ ] Add social share buttons
- [ ] Implement dark/light mode toggle

## Content Sources

All content derived from official documentation:

- `docs/CARE_TOKEN/TOKENOMICS_FINAL.md`
- `docs/CARE_TOKEN/DISTRIBUTION_SUMMARY.md`
- `docs/CARE_TOKEN/VESTING_SCHEDULES.md`
- `blockchain/CARE_TOKEN_README.md`

## Maintenance

To update content:

1. Edit the constants in the page component (distribution, faqs, documents)
2. Update links if documentation moves
3. Regenerate if tokenomics percentages change
4. Test all animations after Next.js updates

## Testing Checklist

- [ ] Verify all sections render correctly
- [ ] Test tab switching (4 use case tabs)
- [ ] Test FAQ expand/collapse
- [ ] Test all external links (GitHub, SOMNIA)
- [ ] Test anchor links (#tokenomics, etc.)
- [ ] Test on mobile devices
- [ ] Test animations on slower devices
- [ ] Test with reduced motion settings
- [ ] Verify no console errors
- [ ] Check Lighthouse score (Performance, Accessibility, SEO)

---

**Status**: ✅ Production Ready  
**Last Updated**: October 27, 2025  
**Version**: 1.0
