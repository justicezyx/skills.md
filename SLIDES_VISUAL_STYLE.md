# Presentation visual style

Reference for HTML slide decks in this repo. Content stays in Markdown file; the deck is a generated HTML view.

## Preferences

- **Format:** one self-contained HTML file (inline CSS and JS, no build step, no CDN).
  - Can reference local images
  - Online images need to be downloaded to local, record its source, and link the local image in the HTML
- **Navigation:** Left/Right arrows, Home / End
- **Page size:** 16:9. On screen the slide is a white 16:9 frame centered on a light gray field. Print and PDF use 13.333in × 7.5in with no browser header.

## Visual (conventional slides)

- Slide background: `#ffffff`. Text: `#000000`.
- Font: Arial, Helvetica, sans-serif (system; no webfonts).
- The area outside the 16:9 frame is `#e6e6e6`. The slide itself is not a card: no shadow, no colored panels, no dark theme.
- **Title slide:** content vertically centered. Title is bold, about 2.4× the body size, with no underline. Subtitle lines stay regular weight.
- **Content slides:** title at the top, bold, with a 3px black rule under it. Body is left-aligned bullets and paragraphs.
- **Figure slides:** same title treatment, slightly smaller. Images sit in the remaining area with `object-fit: contain`. Captions are centered under the image.
- Type scales with the slide width (about 2% of the slide width for body text) so a window and a PDF page look the same. A slide that would overflow shrinks its type until the content fits. Do not scroll a slide.
- Emphasis: bold only where the Markdown uses `**…**`, plus the slide title, which is always bold.
- Links: black, underlined.
- Chrome: slide number only, bottom right of the frame, small and regular weight.

## Content mapping

- Split the Markdown on `---` into one slide per section.
- The first `#` heading on a section is the slide title.
- Figures live in `presentation/` and are referenced by relative path from `slides.html` (not inlined). One figure slide per diagram; pair small screenshots on one slide when they are the same flow.
- Figure slides keep the same white background and black captions.
