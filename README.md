# VedaAI - Assessment Extraction & Answer Mapping

AI-powered tool that lets teachers upload a question paper and student answer sheet, extracts questions, maps answers to questions, and highlights the exact answer regions.

## Live Demo
[Deployed URL will go here]

## Features
- Upload question paper and answer sheet (PDF or images)
- AI-powered question extraction preserving original numbering
- Sub-parts treated as separate questions (e.g. 11a, 11b)
- Handwritten answer detection with bounding box highlighting
- Handles out-of-order answers
- Detects unanswered questions
- Identifies unmatched/orphan answers
- AI grading with per-question feedback
- Responsive design (desktop + mobile)

## Tech Stack
- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS
- **AI Model:** Gemini 3.6 Flash (Google AI Studio, free tier)
- **PDF Rendering:** pdf.js (pdfjs-dist)
- **Deployment:** Vercel

## How It Works
1. Teacher uploads question paper PDF and student answer sheet PDF
2. Pages are rendered to images client-side via pdf.js
3. Question paper images are sent to Gemini to extract all questions in order
4. Answer sheet images + extracted questions are sent to Gemini to identify answers, map them to questions, and return bounding boxes (normalized 0-1000)
5. Results displayed in a two-pane view — questions on the left, highlighted answer sheet on the right

## Approach
- Single Gemini call per document for extraction
- Native bounding box detection (0-1000 normalized coordinates)
- Content-based answer-to-question mapping (not positional)
- No database — fully in-memory

## Limitations
- Bounding box accuracy depends on handwriting clarity
- AI grading is approximate without an answer key
- Very large PDFs may take longer to process

## Setup
```bash
npm install
cp .env.local.example .env.local
# Add your GEMINI_API_KEY to .env.local
npm run dev
```

## Environment Variables
- `GEMINI_API_KEY` — Google AI Studio API key
- `GEMINI_MODEL` — Model name (default: gemini-3.6-flash)