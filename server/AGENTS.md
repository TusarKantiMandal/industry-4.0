# AGENTS.md - Digital AM Check Sheet System Design Guide

## 🎯 Purpose
This document serves as the authoritative design system guide for AI agents (Anthropic Claude, etc.) to create consistent, professional user interfaces for the **Digital AM Check Sheet System**. All UIs must follow these guidelines to maintain brand coherence and user experience quality.

---

## 🎨 Color Palette

### Primary Colors
```css
--primary-dark: #003366;      /* Deep navy blue - headers, primary elements */
--primary-medium: #00bfff;    /* Bright cyan - accents, hover states */
--primary-gradient-start: #003366;
--primary-gradient-end: #002244;
```

### Background Colors
```css
--bg-gradient-light: linear-gradient(135deg, #eef3f8, #dbe7f3);
--bg-gradient-section: linear-gradient(180deg, #f9fbff, #eef4fb);
--card-bg: rgba(255, 255, 255, 0.95);
--navbar-bg: rgba(0, 51, 102, 0.95);
```

### Text Colors
```css
--text-primary: #333;
--text-secondary: #555;
--text-tertiary: #666;
--text-light: white;
```

### Semantic Colors
```css
--success: #28a745;
--warning: #ffc107;
--danger: #dc3545;
--info: #17a2b8;
```

---

## 📐 Layout & Spacing

### Container Widths
- **Max Content Width**: 1400px
- **Card Width**: 260px (desktop), 100% max-width 320px (mobile)
- **Padding Standard**: 20px (mobile), 30px (desktop)

### Spacing Scale
```css
--space-xs: 8px;
--space-sm: 14px;
--space-md: 20px;
--space-lg: 30px;
--space-xl: 50px;
```

### Border Radius
```css
--radius-sm: 6px;   /* Buttons, small elements */
--radius-md: 16px;  /* Cards, containers */
--radius-lg: 20px;  /* Large sections */
```

---

## 🔤 Typography

### Font Family
```css
font-family: "Segoe UI", Roboto, sans-serif;
```

### Font Sizes
```css
--text-hero: 42px (desktop) / 30px (mobile);
--text-h2: 30px;
--text-h3: 20-22px;
--text-body: 18px;
--text-body-sm: 15px;
--text-small: 14px;
```

### Font Weights
- **Regular**: 400
- **Medium**: 500
- **Bold**: 700

### Line Heights
- **Body Text**: 1.5
- **Headings**: 1.2

---

## 🧩 Component Standards

### Navbar
```css
Structure:
- Sticky position (top: 0)
- Background: rgba(0, 51, 102, 0.95)
- Height: ~60px
- Shadow: 0 6px 20px rgba(0, 0, 0, 0.25)
- z-index: 1000

Layout:
- Flex: space-between
- Left: Logo (22px, bold, letter-spacing: 1px)
- Center: Navigation links
- Right: Clock/user info

Navigation Links:
- Padding: 6px 12px
- Border-radius: 6px
- Hover: background #00bfff, color #003366
- Transition: 0.3s
```

### Cards (Info Cards)
```css
Base Style:
- Background: rgba(255, 255, 255, 0.95)
- Width: 260px
- Padding: 28px 22px
- Border-radius: 16px
- Box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15)
- Text-align: center

Hover Effect:
- Transform: translateY(-10px) scale(1.03)
- Box-shadow: 0 18px 40px rgba(0, 0, 0, 0.25)
- Shimmer effect (gradient overlay moving left to right)

Content Structure:
1. Icon (48px, centered, margin-bottom: 15px)
2. Heading (20px, color: #003366, margin-bottom: 8px)
3. Description (15px, color: #555, line-height: 1.5)
```

### Buttons
```css
Primary Button:
- Background: #003366
- Color: white
- Padding: 12px 24px
- Border-radius: 6px
- Font-weight: 500
- Transition: 0.3s
- Hover: background #00bfff, color #003366

Secondary Button:
- Border: 2px solid #003366
- Background: transparent
- Color: #003366
- Hover: background #003366, color white
```

### Forms
```css
Input Fields:
- Padding: 12px 16px
- Border: 2px solid #dbe7f3
- Border-radius: 6px
- Font-size: 15px
- Focus: border-color #00bfff, outline none
- Background: white

Labels:
- Font-size: 14px
- Font-weight: 500
- Color: #003366
- Margin-bottom: 6px
```

### Footer
```css
Background: linear-gradient(135deg, #003366, #002244)
Color: white
Text-align: center
Padding: 14px 0
Font-size: 14px
Position: margin-top auto (sticky to bottom)
```

---

## ✨ Animations & Transitions

### Standard Transitions
```css
transition: 0.3s ease;  /* Default for most interactions */
transition: 0.4s ease;  /* Cards and larger elements */
transition: 0.6s;       /* Shimmer effects */
```

### Keyframe Animations
```css
@keyframes fadeDown {
  from {
    opacity: 0;
    transform: translateY(-20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

Usage: animation: fadeDown 0.8s ease;
```

### Hover States
- **Cards**: Lift up (translateY -10px) + scale (1.03) + enhanced shadow
- **Buttons**: Background color change + smooth transition
- **Links**: Background highlight + color inversion

---

## 📱 Responsive Design

### Breakpoints
```css
/* Mobile First Approach */
@media (max-width: 768px) {
  - Navbar: flex-direction column, gap 10px
  - Hero h1: 30px (from 42px)
  - Cards: width 100%, max-width 320px
  - Padding: reduce from 30px to 20px
  - Font sizes: scale down proportionally
}
```

### Mobile-Specific Rules
- Navigation becomes vertically stacked
- Cards stack in single column
- Touch-friendly tap targets (min 44px)
- Reduced motion for better performance

---

## 🎯 Design Principles

### Visual Hierarchy
1. **Primary Actions**: Bold navy (#003366), prominent size
2. **Secondary Actions**: Outlined, less prominent
3. **Tertiary Actions**: Text links, subtle

### Consistency Rules
- All shadows use rgba(0, 0, 0, 0.X) format
- All gradients use 135deg or 180deg angles
- All cards have consistent padding and border-radius
- All hover effects include transform + shadow changes

### Accessibility
- Color contrast ratio minimum 4.5:1 for text
- Focus states visible for keyboard navigation
- Touch targets minimum 44x44px on mobile
- Alt text for all icons and images

---

## 📋 Page Structure Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Page Title] - Digital AM Check Sheet System</title>
</head>
<body>
  <!-- NAVBAR (sticky top) -->
  <!-- HERO SECTION (if landing page) -->
  <!-- MAIN CONTENT SECTIONS -->
  <!-- FOOTER (sticky bottom) -->
</body>
</html>
```

### CSS Structure Order
1. Reset styles
2. Body & general styles
3. Navbar
4. Hero section
5. Content sections
6. Cards & components
7. Footer
8. Animations
9. Responsive (media queries last)

---

## 🔧 Common Patterns

### Section Layout
```css
.section {
  padding: 50px 20px;
  background: [gradient or solid color];
}

.section-title {
  text-align: center;
  font-size: 30px;
  color: #003366;
  margin-bottom: 10px;
}

.section-subtitle {
  text-align: center;
  font-size: 18px;
  color: #666;
  margin-bottom: 40px;
}
```

### Flex Grid for Cards
```css
.card-wrapper {
  display: flex;
  justify-content: center;
  gap: 30px;
  flex-wrap: wrap;
}
```

### Icon Usage
- Emoji icons preferred for simplicity (⏱️ ⚙️ 📊 👨‍🔧)
- Font size: 48px for card icons
- Centered with margin-bottom: 15px

---

## 🚫 Don'ts (Common Mistakes to Avoid)

❌ Don't use colors outside the defined palette  
❌ Don't use box-sizing without reset  
❌ Don't forget sticky navbar z-index  
❌ Don't mix different border-radius values randomly  
❌ Don't use pure black (#000) - use #333 instead  
❌ Don't create cards without hover effects  
❌ Don't forget mobile responsiveness  
❌ Don't use inline styles (except for dynamic JS values)  
❌ Don't skip the footer  
❌ Don't use more than 2-3 font weights  

---

## ✅ Best Practices

✅ Always include viewport meta tag  
✅ Use CSS custom properties for repeated values  
✅ Implement smooth transitions on interactive elements  
✅ Maintain consistent spacing scale  
✅ Use semantic HTML5 elements  
✅ Test on mobile viewports  
✅ Add meaningful animations (fadeDown, hover lifts)  
✅ Keep card hover effects consistent  
✅ Use flexbox for layouts, grid where appropriate  
✅ Include a clock or timestamp where relevant  

---

## 📝 Example Use Cases

### Creating a Dashboard
- Use navbar with current page highlighted
- Hero section with greeting + date/time
- Card grid for statistics/metrics
- Each card follows the info-card pattern
- Footer at bottom

### Creating a Form Page
- Navbar (same style)
- Centered form container (max-width 600px)
- White card background with padding
- Input fields with focus states
- Primary button for submit
- Footer

### Creating a Data Table
- Navbar
- Page title section
- Table with alternating row colors
- Hover effect on rows
- Action buttons following button styles
- Footer

---

## 🎓 AI Agent Instructions

When creating new pages for the Digital AM Check Sheet System:

1. **Start with the base structure**: navbar → content → footer
2. **Use the color palette**: Never deviate from defined colors
3. **Follow spacing scale**: Use consistent padding/margins
4. **Implement hover effects**: All interactive elements need transitions
5. **Make it responsive**: Test mental model at 768px breakpoint
6. **Add meaningful animations**: fadeDown for headers, lifts for cards
7. **Keep typography consistent**: Use defined font sizes and weights
8. **Test visual hierarchy**: Primary elements should stand out
9. **Maintain brand voice**: Professional, clean, modern, industrial
10. **Add footer credit**: "© 2025 Digital AM Check Sheet System | Developed by Tusar"

---

## 📞 System Context

**Project**: Digital AM Check Sheet System  
**Purpose**: Paperless maintenance tracking and autonomous maintenance  
**Industry**: Manufacturing / Industrial Operations  
**Target Users**: Machine operators, maintenance teams, managers  
**Key Features**: Real-time tracking, zero breakdown goal, data dashboards, ownership culture  

**Brand Personality**: Professional, reliable, modern, data-driven, empowering

---

## 🔄 Version Control

**Version**: 1.0  
**Last Updated**: January 2025  
**Created By**: Tusar  
**For Use By**: Anthropic Claude AI and other AI agents  

---

## 📚 Quick Reference

### Most Common Code Snippets

**Standard Card:**
```html
<div class="info-card">
  <div class="icon">🔧</div>
  <h3>Card Title</h3>
  <p>Card description text goes here.</p>
</div>
```

**Primary Button:**
```html
<button class="btn-primary">Click Me</button>
```

**Section Template:**
```html
<section class="content-section">
  <h2 class="section-title">Section Title</h2>
  <p class="section-subtitle">Subtitle text here</p>
  <div class="card-wrapper">
    <!-- Cards go here -->
  </div>
</section>
```

---

**END OF AGENTS.MD**

*This document ensures consistent, professional UI creation across the entire Digital AM Check Sheet System. Follow these guidelines strictly for all new pages and components.*