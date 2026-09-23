# Presentation visual style

Reference for HTML slide decks in this repo. Content stays in Markdown file; the deck is a generated THML view.

## Preferences

- **Format:** one self-contained HTML file (inline CSS and JS, no build step, no CDN).
  - Can reference local images
  - Online images need to be downloaded to local, record its source, and link the local image in the HTML
- **Navigation:** Left/Right arrows, Home / End

## Visual (Google Drive / Google Slides)

- Background: `#ffffff`
- Text: `#000000`
- Font: Arial, Helvetica, sans-serif (system; no webfonts)
- Titles: large, regular weight, black
  - Opening title slide title font size: 3rem.
  - Figure-slide titles: 1.75rem.
  - Content-slide titles (h1): 2.5rem, weight 400.
- Body: black, left-aligned, generous margins (~7vh / 8vw)
- Emphasis: bold only where the Markdown uses `**…**`
- Links: black, underlined
- Chrome: slide counter only (bottom right). No dark theme, accent colors, or card layouts.

## Content mapping

- Split the Markdown on `---` into one slide per section.
- The first `#` heading on a section is the slide title.
- Figures live in `presentation/` and are referenced by relative path from `slides.html` (not inlined). One figure slide per diagram; pair small screenshots on one slide when they are the same flow.
- Figure slides keep the same white background and black captions. Images scale with `object-fit: contain` so the full figure stays on screen.
