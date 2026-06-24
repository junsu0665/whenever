---
version: beta
name: Wenever-practical-school-planner
description: A quieter school-planner interface for real daily use. The design avoids glossy AI-dashboard cues, oversized rounded cards, decorative gradients, and floating chrome. It uses paper-like surfaces, thin dividers, compact controls, and restrained school-note styling so timetable, meal, board, and notification information stays easy to scan.
---

# Wenever Design Direction

## Principles

- Information first: timetable, meal, board, and alert states should be readable at a glance.
- Low decoration: no glow, glassmorphism, abstract blobs, bento grids, or marketing-style hero blocks.
- Practical student app tone: compact, familiar, and calm rather than futuristic or promotional.
- Flat structure: avoid cards inside cards; prefer rows, rails, sheets, and thin separators.
- Native controls: buttons, tabs, switches, inputs, and segmented controls should feel tappable without looking inflated.

## Palette

```ts
background: '#F6F7F4'
surface: '#FFFFFF'
surfaceAlt: '#EEF1EC'
surfacePressed: '#E8EEE7'
text: '#20251F'
muted: '#626B60'
subtle: '#8B9488'
border: '#DDE3DA'
dividerSoft: '#EAEEE8'
primary: '#315A4D'
primaryDark: '#243F37'
primarySoft: '#E4ECE6'
primaryTint: '#B8CABF'
coral: '#C8654D'
coralSoft: '#F8ECE8'
blue: '#386FA4'
blueSoft: '#E8EFF5'
```

Use deep pine as the main action color, muted clay only for small highlights, and denim blue only where a secondary semantic color is needed. Avoid returning to a one-note green interface.

## Typography

- Font: Noto Sans KR.
- Letter spacing: `0`.
- Headings should be direct and compact; avoid hero-scale type inside app panels.
- Body rows should favor `13-15px` equivalents with clear line height.
- Buttons and tab labels must use explicit type styles and fit their containers.

## Shape And Elevation

```ts
radii.sm: 6
radii.md: 8
radii.lg: 12
radii.xl: 16
```

- Default cards use a 1px border and almost no shadow.
- Bottom navigation is a flat full-width bar with a top border, not a floating pill.
- Active tab icons sit on a quiet tinted chip rather than a filled, high-contrast circle.
- Segmented controls use a pale track and white selected segment with a hairline border.

## Home Screen Pattern

- Header: `홈` plus grade/class and school metadata.
- Notification button: small bordered square, no floating glow.
- Next-class module: white sheet with a left accent line, dark text, muted metadata, and compact progress ticks.
- Timetable strip: small bordered period cells; active class uses border/tint instead of saturated fill.
- Summary: simple row list with icon chips and chevrons.

## Avoid

- Oversized rounded cards and heavy shadows.
- Saturated neon greens or blue/purple gradients.
- Decorative badges, fake analytics, and icon-heavy status widgets.
- In-app text explaining the design or how to use the app.
- Marketing-page composition inside the mobile app.
