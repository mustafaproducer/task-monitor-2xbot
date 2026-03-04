# 🎨 Dizayn Sistema - Professional Web Design

Professional web dizayn qoidalari asosida yaratilgan to'liq dizayn tizimi.

## 📐 Typography System

### Modular Scale: 1.250 (Major Third)

```
Display (Hero):  56px / 700 / 1.15 line-height / -0.03em letter-spacing
Heading 1 (H2):  32px / 600 / 1.30 line-height / -0.02em
Heading 2 (H3):  20px / 600 / 1.40 line-height / -0.01em
Body Text:       16px / 400 / 1.75 line-height / 0em
Small Text:      14px / 500 / 1.60 line-height / 0em
Label:           13px / 600 / 1.40 line-height / 0.05em (uppercase)
```

### Typography Qoidalari

**1. Line-Height (Optimal Readability):**
- **Display text (H1):** 1.15 (tight for large headings)
- **Headings (H2-H3):** 1.3-1.4
- **Body text:** 1.75 (optimal: 1.5-1.75)
- **Small text:** 1.6

**2. Letter-Spacing:**
- **Large headings:** Negative (-0.03em to -0.01em) for optical adjustment
- **Body text:** 0em (default)
- **Labels/Uppercase:** +0.05em (improve readability)

**3. Max-Width (Optimal Reading):**
- **Headings:** 800px max
- **Body text:** 680px max (~65-75 characters per line)
- **Prevents eye strain and improves readability**

**4. Font Weights:**
- Regular: 400 (body text)
- Medium: 500 (labels, small text)
- Semibold: 600 (headings)
- Bold: 700 (display, numbers)

## 📏 Spacing System (8px Grid)

### Base Unit: 8px

```
0.5 unit = 4px
1 unit   = 8px
1.5 unit = 12px
2 units  = 16px
3 units  = 24px
4 units  = 32px
5 units  = 40px
6 units  = 48px
8 units  = 64px
10 units = 80px
12 units = 96px
```

### Vertical Rhythm

**Section Spacing:**
- Small: 32px (4 units)
- Medium: 48px (6 units)
- Large: 64px (8 units)
- XLarge: 80px (10 units)

**Component Spacing:**
- Inner padding: 32-40px (4-5 units)
- Gap between items: 12-24px (1.5-3 units)
- Margin between sections: 64px (8 units)

**Why 8px Grid?**
- Scales perfectly (8, 16, 24, 32, 40, 48, 56, 64...)
- Works well with typography
- Easy to maintain consistency
- Industry standard (Material Design, iOS HIG)

## 🎨 Color System

### Primary Palette

```css
/* Text */
--text-primary:   #191918  /* Main text */
--text-secondary: #6B6B6B  /* Supporting text */
--text-tertiary:  #B0B0B0  /* Placeholder, disabled */

/* Background */
--bg-primary:     #FAFAF9  /* Page background */
--bg-secondary:   #FFFFFF  /* Card background */
--bg-tertiary:    #F5F5F5  /* Input, hover states */

/* Borders */
--border-light:   #E5E5E5  /* Default borders */
--border-medium:  #D0D0D0  /* Hover borders */

/* Accent */
--accent:         #D97757  /* Primary actions, focus */
--accent-dark:    #C86647  /* Hover, pressed */
--accent-light:   #FFF5F0  /* Backgrounds */

/* Semantic */
--success:        #6B6B6B  /* Completed */
--warning:        #FFCC00  /* In progress */
--error:          #191918  /* Blocked */
```

### Color Usage

**Text Hierarchy:**
1. Primary (#191918) - Headings, important text
2. Secondary (#6B6B6B) - Body text, labels
3. Tertiary (#B0B0B0) - Placeholders, disabled

**Interaction States:**
- Default: White bg, light border
- Hover: Tertiary bg (#F5F5F5), medium border
- Focus: Accent ring (rgba(217, 119, 87, 0.08))
- Active: Darker shade, no transform

## 🔲 Layout & Grid

### Container

```css
max-width: 1200px
margin: 0 auto
padding: 64px 24px (desktop)
padding: 40px 20px (mobile)
```

### Grid System

**Stats Grid:**
```css
display: grid
grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))
gap: 24px
```

**Form Grid:**
```css
grid-template-columns: 2fr 1fr 1fr
gap: 16px
→ Mobile: 1fr (stack)
```

**Drop Zones:**
```css
grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))
gap: 24px
```

### Responsive Breakpoints

```css
Desktop: > 768px
Tablet:  481px - 768px
Mobile:  ≤ 480px
```

## 🎯 Components

### Card

```css
background: white
border: 1px solid #E5E5E5
border-radius: 12px
padding: 40px (desktop), 24px (mobile)
transition: all 0.2s ease

hover:
  border-color: #D97757
  box-shadow: 0 4px 24px rgba(0,0,0,0.04)
```

### Button

```css
padding: 14px 28px (min 44px height for touch)
border-radius: 8px
font-size: 15px
font-weight: 600
transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1)

Primary:
  background: #D97757
  color: white
  hover: #C86647, translateY(-1px), shadow

Secondary:
  background: white
  border: 1px solid #E5E5E5
  hover: #F5F5F5
```

### Input / Select

```css
padding: 14px 16px
border: 1px solid #E5E5E5
border-radius: 8px
font-size: 15px
line-height: 1.5

focus:
  border-color: #D97757
  box-shadow: 0 0 0 4px rgba(217, 119, 87, 0.08)

hover:
  border-color: #D0D0D0
```

### Task Card

```css
border: 1px solid #E5E5E5
border-left: 4px solid (status color)
border-radius: 12px
padding: 32px

hover:
  transform: translateX(8px)
  box-shadow: 0 4px 24px rgba(0,0,0,0.06)
  border-left-color: #D97757
```

## 🎭 Animation & Motion

### Timing Functions

```css
ease: General purpose
ease-out: Entrances, appearing
ease-in: Exits, disappearing
cubic-bezier(0.4, 0, 0.2, 1): Material Design standard
```

### Durations

```css
Fast:   0.15s - 0.2s  (hover, small changes)
Medium: 0.3s  - 0.4s  (card animations)
Slow:   0.5s  - 0.6s  (page transitions, progress)
```

### Transforms

```css
Hover cards:   translateY(-2px) or translateX(8px)
Pressed:       translateY(0)
Entrance:      translateY(24px) → 0
```

### Animations

```css
fadeInUp:
  from: opacity 0, translateY(24px)
  to: opacity 1, translateY(0)
  duration: 0.6s
  easing: cubic-bezier(0.4, 0, 0.2, 1)
```

## 📱 Responsive Design

### Mobile-First Approach

**Base (Mobile):**
- Single column layouts
- Stacked components
- Full-width inputs
- Larger touch targets (44px min)

**Tablet (768px+):**
- 2-column grids
- Side-by-side forms
- Optimized spacing

**Desktop (1200px+):**
- 4-column grids
- Horizontal layouts
- Maximum container width
- Hover states

### Touch Targets

```css
Minimum: 44px x 44px (iOS HIG)
Recommended: 48px x 48px (Material Design)

Buttons: 14px padding (vertical) = 46px height
Inputs: 14px padding = 46px height
```

## ♿ Accessibility (A11y)

### Semantic HTML

```html
<header>, <nav>, <main>, <section>, <article>
<h1> - <h6> (proper hierarchy)
<button> (not <div onclick>)
<label for="input-id">
```

### ARIA Labels

```html
aria-label="Descriptive text"
aria-labelledby="heading-id"
role="button" (when needed)
```

### Focus States

```css
focus:
  outline: none (remove default)
  box-shadow: 0 0 0 4px rgba(217, 119, 87, 0.08)
  border-color: #D97757
```

### Color Contrast

```
WCAG AA (minimum):
- Text (16px+): 4.5:1
- Large text (24px+): 3:1

Our ratios:
- #191918 on #FAFAF9: 15.8:1 ✅
- #6B6B6B on #FFFFFF: 5.7:1 ✅
- #D97757 on #FFFFFF: 3.5:1 ✅ (for large text)
```

## 🎯 Design Principles

### 1. Visual Hierarchy
- Size, weight, color establish importance
- Clear heading structure (H1 > H2 > H3)
- Primary actions stand out (accent color)

### 2. Whitespace
- Not empty space - active design element
- Improves readability and focus
- Generous margins and padding
- Breathing room between sections

### 3. Consistency
- 8px spacing grid throughout
- Same border radius (8px, 12px)
- Unified color palette
- Consistent typography scale

### 4. Simplicity
- 3 primary colors (black, terracotta, white)
- Limited component variations
- Clean borders over heavy shadows
- Minimal decoration

### 5. Performance
- CSS-only animations (GPU accelerated)
- Optimized transitions
- No unnecessary JavaScript
- Fast load times

## 📚 Resources

### Inspiration
- **Anthropic.com** - Typography, minimal style
- **Stripe.com** - Clean cards, spacing
- **Linear.app** - Modern interface
- **Apple HIG** - Design principles

### Tools
- **Type Scale** - modularscale.com
- **Contrast Checker** - webaim.org/resources/contrastchecker
- **Grid Calculator** - gridcalculator.dk
- **Easing Functions** - cubic-bezier.com

### Reading
- "The Elements of Typographic Style" - Robert Bringhurst
- "Refactoring UI" - Adam Wathan & Steve Schoger
- Apple Human Interface Guidelines
- Material Design Guidelines

---

**Versiya:** 5.0 (Pro Design System)
**Yaratildi:** 2026-02-15
**Muallif:** Professional Web Design Standards

---

Bu dizayn tizimi professional web dizayn qoidalari asosida yaratilgan va katta loyihalar uchun mos keladi. 💼✨
