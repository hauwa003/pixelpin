# PixelPin

## Overview
Browser-based design QA tool. Designers pin feedback on live websites, the extension auto-detects CSS properties, and converts feedback into measurable, developer-ready instructions.

## Architecture
- **Chrome Extension** — Content script (DOM interaction), Shadow DOM overlay (pins/guides), popup UI
- **Backend API** — Node.js/Express, Supabase (auth + DB)
- **Web Dashboard** — Project & QA management (post-MVP)

## Project Structure
```
extension/       # Chrome extension (MVP focus)
  content/       # Content script — DOM access, element selection, CSS extraction
  overlay/       # Shadow DOM overlay — pins, highlights, measurement guides
  popup/         # Extension popup UI
  background/    # Service worker
  icons/         # Extension icons
  manifest.json  # Chrome extension manifest v3
backend/         # API server
  src/
    routes/      # API endpoints (pins, projects, auth)
    middleware/   # Auth, validation
    models/      # DB models
  config/        # Environment config
dashboard/       # Web dashboard (post-MVP)
```

## Tech Stack
- Extension: TypeScript, Chrome Extension APIs (Manifest V3), Shadow DOM
- Backend: Node.js, Express, Supabase (PostgreSQL + Auth)
- Dashboard: TBD (post-MVP)

## Key Concepts
- **Pins**: Feedback markers attached to DOM elements with position, selector, and bounding box
- **Property Detection**: Uses `window.getComputedStyle()` to extract margin, padding, font-size, color, etc.
- **Feedback Types**: Spacing, Typography, Alignment, Color, Size, General
- **Pin Statuses**: Pending, Resolved, Needs Clarification
- **Selector Priority**: ID > stable class > data attributes > XPath fallback

## Commands
- `npm run dev` — Start backend dev server
- Extension: Load unpacked from `extension/` in chrome://extensions

## Conventions
- Always branch off main before making changes
- Never commit directly to main
