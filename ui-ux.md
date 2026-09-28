# UI/UX Design System

## Design intent

The UI should look like a **high-end remote operations product**, not a stereotypical AI dashboard.

The uploaded reference images are the visual direction:
- warm/off-white background
- deep forest green
- white cards
- dark charcoal typography
- compact left navigation
- clean line icons
- moderate rounded corners
- simple charts
- generous but controlled whitespace
- a few strong accent areas

Create a distinct Antarctic operations identity rather than copying the reference.

## Palette

Use CSS variables:

```css
--bg: #f7f8f4;
--surface: #ffffff;
--surface-soft: #f0f3ed;
--text: #17211b;
--text-muted: #7a847d;
--green: #146b4a;
--green-dark: #0b4a35;
--green-soft: #dceee4;
--border: #e2e6df;
--warning: #b7791f;
--critical: #b33a3a;
--info: #356b9a;
```

Do not turn the entire UI green.

## Layout

Desktop:

```text
┌──────────────┬───────────────────────────────────────────────┐
│              │ Top bar                                       │
│   Sidebar    ├───────────────────────────────────────────────┤
│              │ Page heading + station context                │
│              │                                               │
│              │ KPI cards / status strip                      │
│              │                                               │
│              │ Main operational content                      │
│              │                                               │
│              │ charts / twin / alerts / insights             │
└──────────────┴───────────────────────────────────────────────┘
```

## Navigation

Suggested sections:

- Overview
- Digital Twin
- Infrastructure
- Energy
- Logistics
- Environment
- Intelligence
- Simulations
- Reports

Bottom:

- Settings
- Help

## Important visual rules

### Cards

Use cards when they group meaningful information.

Do not put every tiny metric in a separate card.

### Status

Use small labels such as:

`Operational`
`Warning`
`Critical`
`Offline`
`Simulated`

Pair color with text/icon.

### Charts

Use restrained charts with:
- clear units
- meaningful axes
- comparison context
- tooltips
- no unnecessary 3D

### Twin

Prefer a clean station plan/diagram over a flashy generic 3D model.

Assets can be represented as:
- building blocks
- equipment symbols
- compact markers
- status rings

A 3D view may be added later.

## Typography

Prefer a clean modern sans-serif.

Use:
- 12–13px secondary metadata
- 14–16px body
- 18–24px section headings
- 28–40px major KPI numbers

Avoid giant marketing-style headings.

## Avoid AI-generated visual clichés

Never add:
- sparkle icons next to every AI feature
- purple/blue gradient blobs
- glowing neural-network backgrounds
- floating glass panels
- random futuristic wireframes
- excessive animated particles
- "AI MAGIC" copy
- generic chatbot as the homepage

## Microinteraction

Use subtle:
- 150–250ms transitions
- hover elevation
- chart tooltip fade
- status pulse only for active critical events

Never animate constantly.

## Information hierarchy

Every screen should answer:

1. What is happening?
2. Where is it happening?
3. How serious is it?
4. Why is it happening?
5. What should the operator inspect next?

## Overview layout

Recommended composition:

Top:
- station selector
- connectivity
- last sync
- current station condition

Next:
- energy
- infrastructure
- logistics
- environment summary

Main:
- digital twin station map
- active alerts
- energy trend

Side/bottom:
- upcoming risks
- AI insights
- recent operator actions

## Important

The UI should look designed by a product designer. Avoid a uniform grid where every section has identical cards.
