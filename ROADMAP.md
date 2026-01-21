# Slide Beautifier Roadmap

## Current State (v1.0)

### Completed Features

#### Core Functionality
- **Single Slide Beautification**: Upload an image, apply AI beautification with Gemini
- **Batch Mode**: Process multiple images at once with shared settings
- **PPTX Automation**: Upload PowerPoint, beautify all slides, download result
- **Style Presets**: Professional, Modern, Minimalist, Vibrant, Corporate
- **Aspect Ratio Control**: 16:9, 4:3, 1:1, or auto
- **Custom Prompts**: Edit the beautification prompt
- **Processing History**: View past beautifications

#### Infrastructure
- **Persistent PPTX Storage**: Generated PPTX files saved to `server/data/pptx/`, survives restarts
- **SQLite Database**: Stores jobs, slides, history at `server/data/history.db`
- **Password Protection**: Simple auth with JWT tokens

### Tech Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Express, TypeScript, SQLite (better-sqlite3)
- **AI**: Google Gemini API (gemini-3-pro-image-preview)
- **PPTX**: LibreOffice (extraction), PptxGenJS (creation)

### System Requirements
```bash
# macOS
brew install --cask libreoffice
brew install poppler
```

---

## Next Up (Priority Order)

### 1. Slide Preview in PPTX Mode
**Status**: Not started
**Effort**: Medium

Show before/after thumbnails for each slide after processing completes.

**Implementation Plan**:
- Add thumbnail endpoint: `GET /api/pptx/:jobId/slides/:slideId/thumbnail`
- Return smaller base64 images (resize to ~300px width)
- Update `PptxMode.tsx` results stage to show thumbnail grid
- Click thumbnail to expand full comparison view
- Consider lazy loading for large presentations

**Files to modify**:
- `server/src/routes/pptx.ts` - Add thumbnail endpoint
- `client/src/components/PptxMode.tsx` - Add preview grid UI

---

### 2. Selective Slide Processing
**Status**: Not started
**Effort**: Medium

Let users choose which slides to beautify after extraction.

**Implementation Plan**:
- New stage between upload and configure: "Select Slides"
- Extract slides immediately after upload (before settings)
- Show all slides as checkboxes with thumbnails
- Only selected slides get beautified
- Unselected slides pass through unchanged to final PPTX

**API Changes**:
- `POST /api/pptx/extract` - Extract slides without starting job
- `POST /api/pptx/beautify` - Accept `selectedSlides: number[]` parameter

**Files to modify**:
- `server/src/routes/pptx.ts` - Split extract and beautify
- `server/src/services/pptxProcessor.ts` - Handle selective processing
- `client/src/components/PptxMode.tsx` - Add selection stage

---

### 3. Google Slides Support
**Status**: Not started
**Effort**: Low (MVP) / High (full integration)

**MVP Approach** (Recommended first):
- Add instructions in UI: "Export your Google Slides as .pptx first"
- Link to Google's export documentation
- No code changes needed

**Full Integration** (Future):
- Google OAuth integration
- Fetch presentation via Google Slides API
- Export as PPTX programmatically
- Requires Google Cloud project setup

---

## Future Ideas (Backlog)

### Quality of Life
- [ ] **PPTX Job History**: View past jobs, re-download results
- [ ] **Resume Interrupted Jobs**: Continue if browser closed
- [ ] **Progress Notifications**: Browser notifications when done
- [ ] **Dark Mode**: UI theme toggle

### Advanced Features
- [ ] **Slide-Specific Prompts**: Different prompts for title vs content slides
- [ ] **Template Detection**: Auto-detect slide type and apply appropriate style
- [ ] **Custom Presets**: Save your own prompt templates
- [ ] **Export as PDF**: Download beautified presentation as PDF
- [ ] **Batch PPTX**: Process multiple PPTX files at once

### Analytics & Admin
- [ ] **Cost Tracking Dashboard**: Track Gemini API spend over time
- [ ] **Usage Analytics**: Popular presets, average processing time
- [ ] **Admin Panel**: Manage users, view all jobs

### Integrations
- [ ] **Figma Import**: Import slides from Figma
- [ ] **Canva Import**: Import from Canva presentations
- [ ] **Webhook Notifications**: POST to URL when job completes

---

## Database Schema

### Current Tables

```sql
-- Single image history
history (id, original_image, generated_image, prompt, preset, ...)

-- Batch processing
batches (id, status, total_items, completed_items, ...)
batch_items (id, batch_id, filename, original_image, generated_image, ...)

-- PPTX processing
pptx_jobs (id, status, original_filename, total_slides, completed_slides,
           prompt, preset, result_file_path, ...)
pptx_slides (id, job_id, slide_number, status, original_image, beautified_image, ...)
```

---

## File Structure

```
gom-slide-beautifier/
├── client/                 # React frontend
│   └── src/
│       ├── components/
│       │   ├── PptxMode.tsx      # PPTX automation UI
│       │   ├── BatchMode.tsx     # Batch processing UI
│       │   └── ...
│       ├── lib/
│       │   └── api.ts            # API client functions
│       └── types/
│           └── index.ts          # TypeScript types
├── server/                 # Express backend
│   ├── data/               # SQLite DB + generated PPTX files
│   │   ├── history.db
│   │   └── pptx/           # Persisted PPTX files
│   └── src/
│       ├── routes/
│       │   ├── pptx.ts           # PPTX endpoints
│       │   ├── batch.ts          # Batch endpoints
│       │   └── ...
│       └── services/
│           ├── pptxService.ts    # PPTX extraction/creation
│           ├── pptxProcessor.ts  # Async job processing
│           ├── database.ts       # SQLite operations
│           └── gemini.ts         # Gemini API client
└── ROADMAP.md              # This file
```

---

## Environment Variables

```bash
# Server (.env)
GEMINI_API_KEY=your-key-here
APP_PASSWORD=your-password
PORT=3001

# Client (.env)
VITE_API_URL=http://localhost:3001
```

---

## Quick Start for Development

```bash
# Install dependencies
npm install

# Start both server and client
npm run dev

# Server runs on http://localhost:3001
# Client runs on http://localhost:5173
```

---

## Git Repository

https://github.com/NikolaiGoMedicus/slide-beautifier
