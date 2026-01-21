# Slide Beautifier

A web application that enhances slide/infographic images using Google Gemini API.

## Tech Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS 3
- **Backend**: Express.js + TypeScript
- **AI API**: Google Gemini API (`gemini-2.0-flash-exp-image-generation`)
- **Deployment**: Firebase Hosting (frontend) + Cloud Run (backend)

## Getting Started

### Prerequisites

- Node.js 18+
- Google Gemini API key

### Installation

1. Clone the repository
2. Install dependencies:

```bash
# Install client dependencies
cd client && npm install

# Install server dependencies
cd ../server && npm install
```

3. Configure environment variables:

```bash
# Server (.env in server/)
cp .env.example server/.env
# Edit server/.env and add your GEMINI_API_KEY

# Client (.env in client/)
echo "VITE_API_URL=http://localhost:3001" > client/.env
```

### Development

```bash
# Start the backend (from server/)
cd server && npm run dev

# Start the frontend (from client/)
cd client && npm run dev
```

- Frontend: http://localhost:5173
- Backend: http://localhost:3001

### Production Build

```bash
# Build client
cd client && npm run build

# Build server
cd server && npm run build
```

## Project Structure

```
├── client/           # React frontend
│   └── src/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── types/
├── server/           # Express backend
│   └── src/
│       ├── routes/
│       ├── services/
│       ├── middleware/
│       └── types/
└── firebase.json     # Firebase hosting config
```

## Features

- Upload slide/infographic images (PNG, JPG, WEBP)
- Select from 5 style presets
- Customize enhancement prompts
- Choose output aspect ratio
- Download AI-enhanced images
