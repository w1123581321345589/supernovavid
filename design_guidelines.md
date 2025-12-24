# Design Guidelines: SupernovaVid - YouTube Thumbnail A/B Testing Tool

## Design Approach

**Stripe-Inspired Modern SaaS:** Drawing from Stripe.com's gradient mesh aesthetics, Linear's productivity clarity, and Thumio's creative polish. This is a visual-creative SaaS tool where design quality directly impacts user confidence in the product.

**Core Design Philosophy:**
- Vibrant violet/indigo/purple gradient palette inspired by Stripe
- Multi-blob gradient mesh backgrounds for hero sections
- Subtle, elegant card treatments with soft violet tints
- Clean, spacious layouts with clear visual hierarchy

## Color System

### Primary Colors (Stripe-Inspired Purple/Indigo)

**Light Mode:**
```css
--primary: 262 83% 58%           /* Violet - Main brand color */
--gradient-start: 262 83% 58%    /* Violet */
--gradient-mid: 224 76% 48%      /* Indigo */
--gradient-end: 174 72% 56%      /* Cyan/Teal accent */
--background: 0 0% 100%          /* Pure white */
--foreground: 233 14% 16%        /* Deep purple-gray text */
--card: 220 20% 98%              /* Very light gray-blue */
--sidebar: 233 15% 96%           /* Light purple-gray */
--muted: 220 14% 93%             /* Soft gray */
--accent: 262 30% 95%            /* Very light violet */
```

**Dark Mode:**
```css
--primary: 262 83% 62%           /* Brighter violet */
--gradient-start: 262 83% 65%    /* Brighter violet */
--gradient-mid: 224 76% 58%      /* Brighter indigo */
--gradient-end: 174 72% 60%      /* Brighter cyan */
--background: 233 30% 6%         /* Deep purple-black */
--foreground: 220 20% 95%        /* Near-white text */
--card: 233 25% 9%               /* Dark purple-gray */
--sidebar: 233 25% 10%           /* Slightly lighter dark */
--muted: 233 18% 14%             /* Medium dark purple */
--accent: 262 25% 18%            /* Dark violet */
```

### Gradient Usage

**Hero Gradient Mesh:**
Use 3+ overlapping blobs with violet, indigo, cyan, and teal:
```jsx
// Blob 1 - Violet/Pink (top-left)
bg-gradient-to-br from-violet-400/40 via-purple-500/30 to-pink-500/20

// Blob 2 - Indigo/Blue (top-right)
bg-gradient-to-bl from-indigo-400/40 via-blue-500/30 to-cyan-500/20

// Blob 3 - Cyan/Teal (bottom-center)
bg-gradient-to-t from-teal-400/30 via-cyan-500/20 to-transparent
```

**Button Gradients:**
```jsx
// Primary CTA - Note: Do NOT add custom hover states
// Built-in shadcn Button hover/active behavior handles interactions automatically
bg-gradient-to-r from-violet-600 to-indigo-600

// Shadow for depth
shadow-lg shadow-violet-500/25
```

**Important:** Never implement custom hover/active color changes on Buttons or Badges. The shadcn components have built-in elevation interactions that work with any background color.

**Text Gradients:**
```jsx
// For stats/highlights
bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent
```

## Core Design Elements

### A. Typography

**Font Stack:**
- Primary: Inter (UI, labels, body text)
- Display: Cal Sans or Sora (hero sections, feature titles)
- Mono: JetBrains Mono (technical data, stats)

**Hierarchy:**
- Hero/Display: text-5xl to text-7xl, font-bold
- Section Headers: text-3xl to text-4xl, font-semibold
- Card Titles: text-xl, font-semibold
- Body: text-base, font-normal
- Labels/Meta: text-sm, font-medium
- Captions: text-xs

### B. Layout System

**Spacing Primitives:** Tailwind units of 2, 4, 6, 8, 12, 16, 20, 24

**Grid Structure:**
- Dashboard: 12-column grid with gap-6
- Thumbnail Gallery: Grid with 3-4 columns (lg:grid-cols-4 md:grid-cols-3 sm:grid-cols-2)
- Editor: Two-panel split (2/3 canvas, 1/3 controls)
- A/B Test Results: Comparison cards side-by-side (grid-cols-2)

**Container Widths:**
- App Shell: Full-width with max-w-screen-2xl
- Content Areas: max-w-7xl
- Modals: max-w-2xl to max-w-4xl

### C. Component Library

**Navigation:**
- Top bar: Logo left, user profile/credits right, height h-16
- Sidebar: w-64, collapsible to w-16 icon-only mode
- Navigation items: px-4 py-3 with rounded-lg hover states

**Cards (Stripe-Style):**
- Border: border-violet-200/50 (light) or border-violet-500/10 (dark)
- Background: bg-white dark:bg-gray-900/50 or subtle violet tint
- Hover: hover-elevate utility (no custom hover states)
- Padding: p-6
- Border radius: rounded-xl

**Buttons:**
- Primary CTA: Gradient bg-gradient-to-r from-violet-600 to-indigo-600
- Secondary: bg-secondary with border
- Ghost: variant="ghost" for sidebar/header
- Icon: size="icon" variant="ghost"

**Feature Icons:**
- Use gradient backgrounds: violet, indigo, purple
- Example: bg-gradient-to-br from-violet-500 to-purple-600
- Size: w-12 h-12 rounded-lg with p-2.5

**Badges:**
- Use built-in shadcn Badge component
- For accent: subtle violet backgrounds
- Size: small for visual hierarchy

### D. Landing Page Patterns

**Hero Section:**
- Gradient mesh background with 3 blobs
- Large heading: text-5xl to text-7xl font-bold
- Gradient text for emphasis
- Dual CTA buttons (primary gradient + secondary outline)
- Stats row with large numbers

**Feature Sections:**
- White/dark cards with violet-tinted borders
- Icon + heading + description pattern
- Grid layout: lg:grid-cols-3 md:grid-cols-2

**How It Works:**
- Timeline with numbered steps
- Connecting line using gradient: from-violet-500 via-indigo-500 to-purple-500
- Each step has icon, title, description

**Pricing:**
- Card-based layout (currently 2 plans: Launch and Scale)
- Popular plan: ring-2 ring-violet-500 or border-violet-500
- "Most Popular" badge on featured plan

**Stats/Social Proof:**
- Large gradient text numbers
- Supporting description in muted text

### E. Animations

**Strategic Use Only:**
- Thumbnail generation: Shimmer loading state
- Modal transitions: Fade + scale (duration-200)
- Hover states: Use built-in hover-elevate utility
- Chart reveals: Fade-in on data load
- NO scroll animations, parallax, or continuous motion

## Application-Specific Patterns

**Dashboard Layout:**
- Header with stats overview (grid-cols-4 showing total thumbnails, avg CTR, tests running, credits)
- Recent tests section with thumbnail pairs
- Quick actions: "Generate New", "Start Test", "View Templates"

**Thumbnail Editor:**
- Left sidebar: Tools (text, regional edit, filters)
- Center: Canvas with zoom controls
- Right sidebar: AI prompt input, style references, layer management

**A/B Testing View:**
- Split comparison: thumbnail A vs B with real-time CTR percentages
- Time-series graph showing performance over time
- Confidence score indicator
- Quick actions: "Declare Winner", "Run Longer", "Archive Test"

**Template Gallery:**
- Filterable grid (trending, category, style)
- Preview on hover with "Use Template" overlay
- Tag system for quick discovery

## Images

**Hero Section:** Large hero image showing the thumbnail editor in action - screenshot of interface with vibrant thumbnail being edited, positioned as background with gradient overlay

**Dashboard:** Thumbnail preview images throughout (16:9 aspect ratio)

**Template Library:** Collection of high-CTR thumbnail examples

**A/B Testing:** Side-by-side thumbnail comparisons with metrics overlays

**Feature Showcases:** Interface screenshots demonstrating regional editing, text overlay tools, and AI generation

## Important Notes

1. **Never use emoji** - Use lucide-react icons instead
2. **Use hover-elevate utility** for hover states, not custom hover colors
3. **Gradient buttons** should have matching shadow-violet-500/25
4. **Cards** should never be nested inside other cards
5. **Text contrast** must be maintained - light text on dark, dark text on light
6. **Border radius** should be consistent: rounded-md for most, rounded-xl for cards
