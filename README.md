# AudiViz

Browser-based audio visualizer built with React, Vite, Canvas, and the Web Audio API.

## Current Features

- Upload audio files (MP3/WAV) by click or drag/drop
- Metadata extraction (title, artist, album, cover art)
- Custom audio controls (play/pause, seek, volume, restart, skip to end)
- Visualizer modes: bars + radial
- Live visualizer controls: intensity, hue shift, glow, bar density
- Color systems: rainbow, single color, and multi-stop palette gradients
- Preset workflow: built-in presets, saved presets, JSON import/export
- Full visualizer setting import/export as JSON
- Privacy-first behavior: files are processed locally in the browser

## Run Locally

```bash
npm install
npm run dev
```

Open `http://localhost:5173`.

## Quality Checks

```bash
npm run lint
npm run test:run
npm run build
```

## Professional Workflow in This Repo

- Feature branches + pull requests
- Linting and automated tests
- CI workflow for lint/test/build on pushes and PRs
- Pull request template for consistent reviews

## UI QA Notes (Phase 6)

### Verified

- Responsive desktop layout is stable across common laptop/desktop sizes.
- Queue, center stage, and customizer panels avoid overlap/collision at normal zoom
  levels.
- Keyboard controls are working:
  - `Space` play/pause
  - `←/→` seek
  - `↑/↓` volume
  - `M` mute
  - `P/N` previous/next
  - `S` shuffle
  - `R` repeat
- Focus-visible states are present on interactive controls.
- Queue now-playing highlight and icon tooltips are active.

### Known issue

- Radial visualizer vertical centering can appear low at some browser zoom levels.
- Bars mode is unaffected.
- This is tracked for a later focused canvas/zoom pass.
