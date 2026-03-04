# 📋 Vazifalar - Professional Design System

Professional web dizayn qoidalari asosida yaratilgan zamonaviy vazifalar boshqaruv tizimi.

## 🎨 Dizayn Falsafasi

Professional web dizayn standarti - **Typography-first, Grid-based, Accessible**.

### Asosiy Printsiplar

1. **📐 Typography Hierarchy** - Proper modular scale (1.250)
2. **📏 8px Grid System** - Consistent vertical rhythm
3. **🎯 Visual Hierarchy** - Size, weight, color
4. **⚪ Generous Whitespace** - Readability va focus
5. **♿ Accessibility First** - WCAG AA, semantic HTML
6. **📱 Mobile-First Responsive** - Touch-friendly
7. **✨ Subtle Animations** - Smooth, performant
8. **🎨 Limited Color Palette** - 3 primary colors

## 🎯 Xususiyatlar

### ✨ Core Features
- ✅ Vazifa qo'shish (Title + Deadline + Priority)
- ✅ 4 xil status (Kutilmoqda, Jarayonda, Bajarildi, To'silgan)
- ✅ Progress tracking (foiz ko'rsatkichi)
- ✅ Statistika dashboard
- ✅ Qidiruv va filtrlash
- ✅ Drag & Drop
- ✅ localStorage persistence
- ✅ JSON Export

### 🎨 Professional Design
- ✨ **Typography System** - Modular scale, optimal line-height
- 📏 **8px Grid** - Perfect vertical rhythm
- 🎯 **Touch Targets** - 44px minimum (iOS HIG)
- ♿ **Accessibility** - WCAG AA, ARIA labels
- 📱 **Responsive** - Mobile-first, 3 breakpoints
- 🎭 **Smooth Animations** - GPU-accelerated
- 🌈 **Color System** - Semantic, high contrast

## 📐 Dizayn Sistema

### Typography Scale (Modular 1.250)

```
Display:  56px / Bold / 1.15 line-height
H2:       32px / Semibold / 1.30 line-height
H3:       20px / Semibold / 1.40 line-height
Body:     16px / Regular / 1.75 line-height
Small:    14px / Medium / 1.60 line-height
Label:    13px / Semibold / 1.40 line-height
```

**Why these numbers?**
- **Line-height 1.75** - Optimal readability for body text
- **Max-width 680px** - ~65-75 characters per line
- **Negative letter-spacing** - Optical adjustment for large text

### 8px Grid System

```
Base: 8px
Scale: 8, 16, 24, 32, 40, 48, 64, 80, 96px
```

**Benefits:**
- Perfect vertical rhythm
- Scales cleanly
- Industry standard
- Easy to maintain

### Color Palette

```css
Primary Text:   #191918
Secondary Text: #6B6B6B
Placeholder:    #B0B0B0

Background:     #FAFAF9
Card:           #FFFFFF
Input/Hover:    #F5F5F5

Border Light:   #E5E5E5
Border Medium:  #D0D0D0

Accent:         #D97757 (Terracotta)
Accent Dark:    #C86647
Accent Light:   #FFF5F0
```

## 🚀 Ishlatish

1. **Ochish:**
   ```bash
   open index.html
   ```

2. **Vazifa qo'shish:**
   - Vazifa nomini kiriting
   - Deadline tanlang (optional)
   - Priority belgilang
   - "Vazifa qo'shish" yoki Enter

3. **Status o'zgartirish:**
   - **Dropdown** - Har bir vazifada
   - **Drag & Drop** - Drop zone ga sudrab tashlang

4. **Qidirish va filtrlash:**
   - Qidiruv maydoni (vazifa nomi)
   - Status filtrlari

5. **Export:**
   - Export tugmasi → JSON yuklab olish

## 📁 Fayl Strukturasi

```
task-monitor/
├── index.html                  # Pro Design System (v5.0) ⭐
├── index-pro-design.html       # Pro Design (backup)
├── index-anthropic-old.html    # Anthropic (v4.0)
├── index-glass-backup.html     # Liquid Glass (v3.0)
├── index-pro-full.html         # Pro Full (v2.0)
├── index-basic.html            # Basic (v1.0)
├── README.md                   # Bu fayl
└── DESIGN-SYSTEM.md           # To'liq dizayn dokumentatsiya
```

## 📚 Dizayn Dokumentatsiya

To'liq dizayn tizimi dokumentatsiyasi uchun:

```bash
cat DESIGN-SYSTEM.md
```

**Qamrab oladi:**
- Typography system (modular scale, line-heights)
- 8px grid (spacing scale, vertical rhythm)
- Color system (palette, usage, contrast ratios)
- Component library (cards, buttons, inputs)
- Animation guidelines (timing, easing)
- Responsive breakpoints
- Accessibility (WCAG AA, ARIA, semantic HTML)
- Design principles

## 🎓 Web Dizayn Qoidalari

### Typography
✅ Proper line-height (1.75 for body)
✅ Max-width for readability (680px)
✅ Modular scale (1.250 ratio)
✅ Negative letter-spacing for large text
✅ Proper font weights (400, 500, 600, 700)

### Layout
✅ 8px grid system
✅ Consistent spacing
✅ Generous whitespace
✅ Proper section gaps
✅ Responsive grid

### Components
✅ Touch targets (44px min)
✅ Focus states (ring shadow)
✅ Hover feedback
✅ Smooth transitions
✅ Semantic HTML

### Accessibility
✅ WCAG AA contrast (15.8:1, 5.7:1)
✅ ARIA labels
✅ Keyboard navigation
✅ Screen reader friendly
✅ Semantic markup

## 📱 Responsive Breakpoints

```css
Mobile:  ≤ 480px  (1 column)
Tablet:  481-768px (2 columns)
Desktop: > 768px   (4 columns)
```

**Mobile-first approach:**
- Base styles for mobile
- Progressive enhancement
- Touch-friendly (44px targets)
- Stacked layouts

## ⌨️ Keyboard Shortcuts

- `Enter` - Vazifa qo'shish
- `Tab` - Navigate
- `Space` - Select

## ♿ Accessibility

- ✅ Semantic HTML5 (header, section, article)
- ✅ ARIA labels (all interactive elements)
- ✅ Keyboard navigation
- ✅ Focus indicators
- ✅ High contrast (WCAG AA)
- ✅ Screen reader friendly

## 🛠️ Texnologiyalar

- **React 18** - UI framework
- **Inter Font** - Professional typography
- **CSS Grid** - Modern layout
- **HTML5 Drag & Drop** - Native interactions
- **localStorage** - Data persistence

## 🎨 Design Credits

**Printsiplar:**
- Apple Human Interface Guidelines
- Material Design (Google)
- Refactoring UI (Adam Wathan)
- Typography principles (Bringhurst)

**Inspiratsiya:**
- Anthropic.com - Typography, minimal
- Stripe.com - Clean cards
- Linear.app - Modern interface

## 📊 Performance

- ✅ GPU-accelerated animations
- ✅ Optimized transitions
- ✅ No unnecessary JavaScript
- ✅ Fast load times
- ✅ Minimal CSS (inline, organized)

## 🔄 Versiya Tarixi

### v5.0 - Professional Design System (current)
- ✨ Typography system (modular scale)
- 📏 8px grid (vertical rhythm)
- ♿ Accessibility (WCAG AA, ARIA)
- 📱 Mobile-first responsive
- 🎯 Touch targets (44px)
- 🎨 Visual hierarchy
- ✨ Professional animations

### v4.0 - Anthropic Design
- Anthropic.com inspired
- 3 colors (black, terracotta, white)
- Typography-focused

### v3.0 - Liquid Glass
- Glassmorphism
- Gradient backgrounds

### v2.0 - Pro
- Dark mode
- Full features

### v1.0 - Basic
- Simple task manager

## 💡 Best Practices

1. **Typography:**
   - Use proper line-height
   - Limit line length (65-75 chars)
   - Maintain visual hierarchy

2. **Spacing:**
   - Follow 8px grid
   - Use generous whitespace
   - Consistent gaps

3. **Colors:**
   - Limit palette (3 primary)
   - High contrast text
   - Semantic usage

4. **Responsive:**
   - Mobile-first
   - Touch-friendly
   - Flexible grids

5. **Accessibility:**
   - Semantic HTML
   - ARIA labels
   - Keyboard support

## 📖 Qo'shimcha O'qish

- `DESIGN-SYSTEM.md` - To'liq dizayn dokumentatsiya
- Apple HIG - design.apple.com
- Material Design - material.io
- Web Content Accessibility Guidelines (WCAG)

---

**Versiya:** 5.0 (Professional Design System)
**Yaratildi:** 2026-02-15
**Dizayn:** Professional Web Standards
**Shrift:** Inter
**Til:** O'zbek (Lotin)

---

**Made with 💼 by Professional Web Designer**

Professional web dizayn qoidalari asosida yaratilgan. Typography, layout, accessibility, va responsiveness bo'yicha eng yaxshi amaliyotlar qo'llanilgan. 🎯✨
