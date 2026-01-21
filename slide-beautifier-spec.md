# Specification: Slide Beautifier MVP

## 1. Project Goal

A web-based application that visually enhances individual slide images (infographics, presentation slides) using the Google Nano Banana Pro API. Users upload an image, select a style preset, optionally customize the prompt, and receive an AI-generated enhanced image for download.

---

## 2. Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS 3 |
| Backend | Express.js (Node) |
| AI API | Google Gemini API (Nano Banana Pro: `gemini-3-pro-image-preview`) |
| Language | TypeScript |
| Hosting | Firebase Hosting (Frontend) + Cloud Run (Backend) |
| Auth | None (prototype) |

---

## 3. Architecture

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │         │                 │         │                 │
│  React Frontend │────────▶│  Express API    │────────▶│  Google Gemini  │
│  (Firebase)     │  POST   │  (Cloud Run)    │  REST   │  API            │
│                 │◀────────│                 │◀────────│                 │
└─────────────────┘  JSON   └─────────────────┘  Image  └─────────────────┘
                   (base64)
```

**Why this setup?**
- API key protection (not exposed in browser)
- Firebase Hosting: fast CDN, easy deploys
- Cloud Run: serverless, scales to zero, pay-per-use

---

## 4. Core Features (MVP)

### 4.1 Image Upload
- Drag & drop or file picker
- Accepted formats: PNG, JPG, WEBP
- Max file size: 10MB
- Preview of uploaded image

### 4.2 Style Presets

| Preset ID | Name | Prompt Template |
|-----------|------|-----------------|
| `medical-professional` | Medical Professional | "Enhance this infographic with a clean, professional medical aesthetic. Use a calming blue and white color palette, modern sans-serif typography, and subtle iconography. Maintain all existing text and data accuracy." |
| `modern-minimal` | Modern Minimal | "Transform this slide into a modern minimalist design. Use ample white space, a restrained color palette, clean lines, and contemporary typography. Preserve all content and hierarchy." |
| `vibrant-engaging` | Vibrant & Engaging | "Make this infographic more visually engaging with vibrant colors, dynamic layouts, and eye-catching visual elements. Keep it professional but energetic." |
| `corporate-clean` | Corporate Clean | "Redesign this slide with a polished corporate aesthetic. Use a professional color scheme, structured grid layout, and business-appropriate styling." |
| `custom` | Custom | User-defined prompt (freeform) |

### 4.3 Prompt Customization
- Textarea showing the selected preset's prompt
- User can edit/extend
- Character limit: 2000 chars

### 4.4 Generation
- "Generate" button triggers API call
- Loading state with spinner
- Error handling with user-friendly messages

### 4.5 Result Display
- Side-by-side comparison: Original vs. Generated
- Download button (PNG)
- "Try Again" button to regenerate

---

## 5. API Specification

### 5.1 Backend Endpoint

```
POST /api/beautify
Content-Type: application/json
```

**Request:**
```typescript
interface BeautifyRequest {
  image: string;        // Base64 encoded image
  mimeType: string;     // "image/png" | "image/jpeg" | "image/webp"
  prompt: string;       // Final prompt
  aspectRatio?: string; // "16:9" | "4:3" | "1:1" (default: auto)
}
```

**Response (Success):**
```typescript
interface BeautifyResponseSuccess {
  success: true;
  image: string;        // Base64 result
  mimeType: "image/png";
  metadata: {
    model: string;
    processingTime: number;
  };
}
```

**Response (Error):**
```typescript
interface BeautifyResponseError {
  success: false;
  error: {
    code: string;
    message: string;
  };
}
```

### 5.2 Gemini Integration

```typescript
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateImage(
  base64Image: string,
  mimeType: string,
  prompt: string,
  aspectRatio: string = "16:9"
) {
  const response = await ai.models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: [
      { text: prompt },
      { inlineData: { mimeType, data: base64Image } },
    ],
    config: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: aspectRatio,
        imageSize: "2K",
      },
    },
  });

  // Extract image from response
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return {
        image: part.inlineData.data,
        mimeType: part.inlineData.mimeType,
      };
    }
  }

  throw new Error("No image in response");
}
```

---

## 6. UI Components

### 6.1 Component Tree

```
<App>
  <Header />
  <main>
    <UploadSection>
      <DropZone />
      <ImagePreview />
    </UploadSection>
    
    <ControlsSection>
      <PresetSelector />
      <PromptEditor />
      <AspectRatioSelector />
      <GenerateButton />
    </ControlsSection>
    
    <ResultSection>
      <ComparisonView />
      <DownloadButton />
      <RegenerateButton />
    </ResultSection>
  </main>
</App>
```

### 6.2 State Management

Simple React state (no external library needed for MVP):

```typescript
interface AppState {
  // Upload
  originalImage: string | null;
  originalMimeType: string | null;
  
  // Controls
  selectedPreset: PresetId;
  customPrompt: string;
  aspectRatio: AspectRatio;
  
  // Generation
  isGenerating: boolean;
  generatedImage: string | null;
  error: string | null;
}

type PresetId = 
  | "medical-professional"
  | "modern-minimal"
  | "vibrant-engaging"
  | "corporate-clean"
  | "custom";

type AspectRatio = "16:9" | "4:3" | "1:1" | "auto";
```

---

## 7. File Structure

```
slide-beautifier/
├── client/                          # React Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                  # Reusable UI components
│   │   │   │   ├── Button.tsx
│   │   │   │   ├── Card.tsx
│   │   │   │   ├── Select.tsx
│   │   │   │   └── Spinner.tsx
│   │   │   ├── DropZone.tsx
│   │   │   ├── ImagePreview.tsx
│   │   │   ├── PresetSelector.tsx
│   │   │   ├── PromptEditor.tsx
│   │   │   ├── AspectRatioSelector.tsx
│   │   │   ├── GenerateButton.tsx
│   │   │   ├── ComparisonView.tsx
│   │   │   └── DownloadButton.tsx
│   │   ├── hooks/
│   │   │   └── useBeautify.ts       # API call hook
│   │   ├── lib/
│   │   │   ├── presets.ts           # Preset definitions
│   │   │   ├── api.ts               # API client
│   │   │   └── utils.ts             # Helper functions
│   │   ├── types/
│   │   │   └── index.ts
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css                # Tailwind imports
│   ├── public/
│   ├── index.html
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── tsconfig.json
│   └── package.json
│
├── server/                          # Express Backend
│   ├── src/
│   │   ├── routes/
│   │   │   └── beautify.ts
│   │   ├── services/
│   │   │   └── gemini.ts            # Gemini API wrapper
│   │   ├── middleware/
│   │   │   ├── validation.ts
│   │   │   ├── errorHandler.ts
│   │   │   └── cors.ts
│   │   ├── types/
│   │   │   └── index.ts
│   │   └── index.ts                 # Express app entry
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── tsconfig.json
│   └── package.json
│
├── firebase.json                    # Firebase config
├── .firebaserc                      # Firebase project
├── .env.example
├── .gitignore
└── README.md
```

---

## 8. Deployment Configuration

### 8.1 Firebase (firebase.json)

```json
{
  "hosting": {
    "public": "client/dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  }
}
```

### 8.2 Cloud Run (Dockerfile)

```dockerfile
FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist

ENV PORT=8080
EXPOSE 8080

CMD ["node", "dist/index.js"]
```

### 8.3 Deployment Commands

**Frontend (Firebase Hosting):**
```bash
cd client
npm run build
firebase deploy --only hosting
```

**Backend (Cloud Run):**
```bash
cd server
npm run build
gcloud run deploy slide-beautifier-api \
  --source . \
  --region europe-west1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=$GEMINI_API_KEY
```

---

## 9. Environment Variables

### Server (.env)
```env
GEMINI_API_KEY=your_api_key_here
PORT=8080
NODE_ENV=production
ALLOWED_ORIGINS=https://your-firebase-app.web.app,http://localhost:5173
```

### Client (.env)
```env
VITE_API_URL=http://localhost:3001        # Development
# VITE_API_URL=https://your-cloud-run.run.app  # Production
```

---

## 10. Error Handling

| Code | Cause | User Message |
|------|-------|--------------|
| `INVALID_IMAGE` | Unsupported format or corrupted | "Please upload a valid PNG, JPG, or WEBP image." |
| `FILE_TOO_LARGE` | Exceeds 10MB limit | "Image too large. Maximum size is 10MB." |
| `API_ERROR` | Gemini API failure | "Generation failed. Please try again." |
| `RATE_LIMIT` | Too many requests | "Too many requests. Please wait a moment." |
| `SAFETY_FILTER` | Content blocked by Gemini | "Image could not be processed. Try a different image." |
| `TIMEOUT` | Request took too long | "Request timed out. Please try again." |

---

## 11. Development Phases

### Phase 1: Foundation
- [ ] Initialize monorepo structure
- [ ] Setup Vite + React + TypeScript + Tailwind
- [ ] Setup Express + TypeScript
- [ ] Create basic UI layout (header, sections)
- [ ] Implement DropZone component
- [ ] Implement ImagePreview component

### Phase 2: Core Integration
- [ ] Setup Gemini API service in backend
- [ ] Create `/api/beautify` endpoint
- [ ] Implement preset system (data + UI)
- [ ] Implement PromptEditor component
- [ ] Create useBeautify hook
- [ ] Wire up end-to-end generation flow

### Phase 3: Polish & Deploy
- [ ] Add loading states and spinner
- [ ] Implement error handling UI
- [ ] Create ComparisonView (side-by-side)
- [ ] Add download functionality
- [ ] Setup Firebase project
- [ ] Deploy frontend to Firebase Hosting
- [ ] Deploy backend to Cloud Run
- [ ] Test production environment

---

## 12. API Rate Limits & Pricing

### Gemini 3 Pro Image (Nano Banana Pro)
- **Paid preview** - check current pricing at https://ai.google.dev/pricing
- Higher latency than Flash model (uses "Thinking" mode)
- Better text rendering and quality for infographics

### Recommended Settings
- `imageSize: "2K"` - good quality/speed balance
- `aspectRatio: "16:9"` - standard presentation format
- Consider implementing client-side debounce to prevent accidental double-submissions

---

## 13. Future Enhancements (Post-MVP)

| Priority | Feature | Description |
|----------|---------|-------------|
| High | Multi-slide batch | Upload ZIP or multiple images, process as batch |
| High | Generation history | LocalStorage-based history of generations |
| Medium | PPTX import | Parse PowerPoint, extract slides as images |
| Medium | PPTX export | Reassemble enhanced images into PowerPoint |
| Medium | Multi-turn editing | Chat-style iterative refinement |
| Low | Custom brand presets | Save custom presets with logo, colors, fonts |
| Low | Grounding with Search | Real-time data for charts and statistics |
| Low | User accounts | Firebase Auth for saving preferences |

---

## 14. Security Considerations

- **API Key**: Never expose in frontend; always proxy through backend
- **Input Validation**: Validate file type, size, and content on both client and server
- **CORS**: Restrict to known origins in production
- **Rate Limiting**: Consider implementing per-IP rate limiting (future)
- **Content**: Gemini has built-in safety filters; handle rejections gracefully

---

## 15. Testing Strategy (Future)

| Type | Tool | Coverage |
|------|------|----------|
| Unit | Vitest | Utility functions, hooks |
| Component | React Testing Library | UI components |
| E2E | Playwright | Critical user flows |
| API | Supertest | Backend endpoints |

---

## Appendix A: Preset Prompt Templates

```typescript
export const PRESETS = {
  "medical-professional": {
    id: "medical-professional",
    name: "Medical Professional",
    description: "Clean, trustworthy healthcare aesthetic",
    prompt: `Enhance this infographic with a clean, professional medical aesthetic. 
Use a calming blue and white color palette with subtle teal accents. 
Apply modern sans-serif typography (like Open Sans or Roboto). 
Add subtle medical iconography where appropriate. 
Maintain all existing text content and data accuracy. 
Ensure high contrast for readability. 
Keep the layout structured and scannable.`,
  },
  
  "modern-minimal": {
    id: "modern-minimal",
    name: "Modern Minimal",
    description: "Clean, spacious, contemporary design",
    prompt: `Transform this slide into a modern minimalist design.
Use ample white space to let content breathe.
Apply a restrained color palette: primarily white/light gray with one accent color.
Use clean geometric lines and shapes.
Apply contemporary typography with clear hierarchy.
Remove visual clutter while preserving all information.
Ensure the design feels premium and sophisticated.`,
  },
  
  "vibrant-engaging": {
    id: "vibrant-engaging",
    name: "Vibrant & Engaging",
    description: "Eye-catching, dynamic, energetic",
    prompt: `Make this infographic more visually engaging and dynamic.
Use vibrant, harmonious colors that pop.
Add visual interest through creative layouts and shapes.
Include eye-catching graphic elements and illustrations.
Maintain professionalism while being energetic.
Ensure all text remains legible against colorful backgrounds.
Create visual flow that guides the viewer through the content.`,
  },
  
  "corporate-clean": {
    id: "corporate-clean",
    name: "Corporate Clean",
    description: "Polished, business-appropriate, structured",
    prompt: `Redesign this slide with a polished corporate aesthetic.
Use a professional color scheme (navy, gray, white with subtle accent).
Apply a structured grid-based layout.
Use business-appropriate typography (clean, readable).
Add subtle professional design elements (lines, shapes).
Ensure the design conveys credibility and competence.
Maintain clear information hierarchy.`,
  },
  
  "custom": {
    id: "custom",
    name: "Custom",
    description: "Write your own prompt",
    prompt: "",
  },
} as const;
```

---

## Appendix B: Type Definitions

```typescript
// types/index.ts

export type PresetId = 
  | "medical-professional"
  | "modern-minimal"
  | "vibrant-engaging"
  | "corporate-clean"
  | "custom";

export type AspectRatio = "16:9" | "4:3" | "1:1" | "auto";

export type MimeType = "image/png" | "image/jpeg" | "image/webp";

export interface Preset {
  id: PresetId;
  name: string;
  description: string;
  prompt: string;
}

export interface BeautifyRequest {
  image: string;
  mimeType: MimeType;
  prompt: string;
  aspectRatio?: AspectRatio;
}

export interface BeautifyResponse {
  success: boolean;
  image?: string;
  mimeType?: string;
  metadata?: {
    model: string;
    processingTime: number;
  };
  error?: {
    code: string;
    message: string;
  };
}

export interface AppState {
  originalImage: string | null;
  originalMimeType: MimeType | null;
  selectedPreset: PresetId;
  customPrompt: string;
  aspectRatio: AspectRatio;
  isGenerating: boolean;
  generatedImage: string | null;
  error: string | null;
}
```
