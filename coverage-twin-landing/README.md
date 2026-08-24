# Coverage Twin Landing Page

A standalone implementation inspired by the supplied scrolling reference video, rebuilt with original Coverage Twin content and a custom palette:

- Background: `#F4F6F3`
- Ink: `#07130C`
- Deep forest: `#063B22`
- Signal lime: `#C7F36B`
- Action green: `#20C878`
- Grid: `#DCE2DD`
- Muted: `#68716B`

## Included
- Editorial split hero
- Procedural pixel-field hero animation
- Subtle grid system
- Horizontal case showcase rail
- Scroll-reactive particle/scatter animation
- Pixel-face governance section
- Scroll-reactive lifecycle visualization
- Coverage Context Protocol visualization
- Evidence/proof cards
- Pixel cursor character
- Responsive layout
- Reduced-motion fallback

## Preview
Open `index.html` in a browser. For the smoothest local preview, serve the folder:

```bash
python3 -m http.server 8080
```

then open `http://localhost:8080`.

## Integrating into the existing Coverage Twin Next.js app
This package is intentionally framework-independent so the visual behavior is easy to inspect. Port:
- markup → your `app/page.tsx` or landing page component
- CSS → global/module stylesheet
- the canvas functions → client components (`"use client"`)

The final CTA currently points to `/dashboard`; change this only if your real product route differs.

## Important
This recreates the reference's layout language and motion system with original content and procedural graphics rather than copying the reference brand, copy, images, or proprietary assets.
