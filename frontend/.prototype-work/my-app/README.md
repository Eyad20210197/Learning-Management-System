# FirstCommit landing page

A responsive landing page concept for a beginner-focused programming LMS. It presents short crash courses, an interactive course preview, beginner-first learning benefits, FAQs, and a lightweight email CTA.

## Run locally

```bash
npm install
npm run dev
```

## Validate

```bash
npm run lint
npm run build
```

## Motion system

The page uses free React Bits components only:

- `Lightfall` for the interactive hero background
- `BlurText` for the hero headline reveal
- `AnimatedContent` for scroll-triggered section entrances
- `Magnet` for primary CTA interactions
- `SpotlightCard` for course and feature card hover lighting

Motion is reduced automatically when the visitor enables `prefers-reduced-motion`.
