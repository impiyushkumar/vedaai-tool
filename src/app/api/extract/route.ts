import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import type { NextRequest } from 'next/server';
import type { BoundingBox } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 300;

// gemini-2.5-flash returns 404 for new API keys ("no longer available to new
// users"); the API itself points at gemini-3.6-flash as the replacement.
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash';

export interface ExtractedQuestion {
  id: string;
  number: number;
  part?: string;
  text: string;
  score: number;
  maxScore: number;
  feedback: string;
  status: 'answered' | 'unanswered' | 'orphan';
  regions: BoundingBox[];
}

export interface OrphanAnswer {
  text: string;
  regions: BoundingBox[];
}

export interface ExtractResponse {
  questions: ExtractedQuestion[];
  orphanAnswers: OrphanAnswer[];
}

interface ExtractRequestBody {
  questionPaperPages?: string[];
  answerSheetPages?: string[];
}

/** A question as Gemini returns it, before we assign ids. */
interface RawQuestion {
  number: number;
  part: string | null;
  text: string;
  maxScore: number;
}

/** Gemini returns boxes as [yMin, xMin, yMax, xMax] normalized to 0-1000. */
interface RawRegion {
  page: number;
  box_2d: [number, number, number, number];
}

interface RawMapping {
  questionId: string;
  score: number;
  feedback: string;
  regions: RawRegion[];
}

interface RawOrphan {
  text: string;
  regions: RawRegion[];
}

interface RawMappingResponse {
  mappings?: RawMapping[];
  orphanAnswers?: RawOrphan[];
}

class ExtractionError extends Error {}

function getModel() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new ExtractionError(
      'GEMINI_API_KEY is not set. Add it to .env.local and restart the dev server.'
    );
  }
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: MODEL });
}

function imageParts(pages: string[]): Part[] {
  return pages.map((data) => ({
    inlineData: { data, mimeType: 'image/jpeg' },
  }));
}

/**
 * responseMimeType: 'application/json' usually suppresses markdown fences, but
 * not reliably — strip them and retry before giving up.
 */
function parseJsonResponse<T>(raw: string, label: string): T {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    try {
      return JSON.parse(cleaned) as T;
    } catch {
      console.error(`[extract] ${label}: could not parse response as JSON.`);
      console.error(`[extract] ${label}: raw response was:\n${raw}`);
      throw new ExtractionError(
        `Gemini returned malformed JSON while ${label}. See server logs.`
      );
    }
  }
}

async function callGemini(
  pages: string[],
  prompt: string,
  label: string
): Promise<string> {
  const model = getModel();
  try {
    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [...imageParts(pages), { text: prompt }],
        },
      ],
      generationConfig: { responseMimeType: 'application/json' },
    });
    return result.response.text();
  } catch (error) {
    console.error(`[extract] ${label}: Gemini request failed:`, error);
    throw new ExtractionError(
      `Gemini request failed while ${label}: ${
        error instanceof Error ? error.message : 'unknown error'
      }`
    );
  }
}

const QUESTIONS_PROMPT =
  'You are an exam paper parser. Extract every question from this question paper in printed order. Treat labelled sub-parts as SEPARATE questions — e.g. 11(a) and 11(b) are two entries. Preserve original numbering. Return ONLY a JSON array, no markdown fences: [{"number": 1, "part": null, "text": "full question text", "maxScore": 5}, ...]';

async function extractQuestions(pages: string[]): Promise<ExtractedQuestion[]> {
  const raw = await callGemini(pages, QUESTIONS_PROMPT, 'extracting questions');
  const parsed = parseJsonResponse<RawQuestion[]>(raw, 'extracting questions');

  if (!Array.isArray(parsed)) {
    throw new ExtractionError(
      'Expected a JSON array of questions from Gemini.'
    );
  }

  return parsed.map((question, index) => ({
    id: `q${index + 1}`,
    number: Number(question.number) || index + 1,
    // Gemini emits null for unparted questions; the field is optional here.
    ...(question.part ? { part: String(question.part) } : {}),
    text: String(question.text ?? ''),
    score: 0,
    maxScore: Number(question.maxScore) || 0,
    feedback: '',
    status: 'unanswered' as const,
    regions: [],
  }));
}

/** [yMin, xMin, yMax, xMax] at 0-1000 -> BoundingBox at 0-1. `page` stays 0-indexed. */
function toBoundingBox(region: RawRegion): BoundingBox | null {
  const box = region?.box_2d;
  if (!Array.isArray(box) || box.length !== 4 || box.some((n) => typeof n !== 'number')) {
    return null;
  }
  const [yMin, xMin, yMax, xMax] = box;
  return {
    page: Number(region.page) || 0,
    yMin: yMin / 1000,
    xMin: xMin / 1000,
    yMax: yMax / 1000,
    xMax: xMax / 1000,
  };
}

function toBoundingBoxes(regions: RawRegion[] | undefined): BoundingBox[] {
  if (!Array.isArray(regions)) return [];
  return regions
    .map(toBoundingBox)
    .filter((box): box is BoundingBox => box !== null);
}

function mappingPrompt(questions: ExtractedQuestion[]): string {
  const forModel = questions.map((q) => ({
    id: q.id,
    number: q.number,
    part: q.part ?? null,
    text: q.text,
    maxScore: q.maxScore,
  }));

  return (
    'You are an answer sheet analyzer. Here are the questions: ' +
    JSON.stringify(forModel) +
    '. For each handwritten answer on these pages: match it to a question by number/label, draw a bounding box as box_2d [yMin, xMin, yMax, xMax] normalized 0-1000, score it, and write brief feedback. Return ONLY JSON, no fences: {"mappings": [{"questionId": "q1", "score": 3, "feedback": "brief feedback", "regions": [{"page": 0, "box_2d": [100, 50, 400, 950]}]}], "orphanAnswers": [{"text": "unmatched answer description", "regions": [{"page": 0, "box_2d": [500, 50, 700, 950]}]}]}. page is 0-indexed. If a question has no answer, omit it from mappings. Answers not matching any question go in orphanAnswers.'
  );
}

async function extractAnswersAndMap(
  pages: string[],
  questions: ExtractedQuestion[]
): Promise<ExtractResponse> {
  const raw = await callGemini(
    pages,
    mappingPrompt(questions),
    'mapping answers'
  );
  const parsed = parseJsonResponse<RawMappingResponse>(raw, 'mapping answers');

  const byQuestionId = new Map<string, RawMapping>();
  for (const mapping of parsed.mappings ?? []) {
    if (mapping?.questionId) byQuestionId.set(mapping.questionId, mapping);
  }

  const merged = questions.map((question): ExtractedQuestion => {
    const mapping = byQuestionId.get(question.id);
    if (!mapping) {
      return { ...question, status: 'unanswered', score: 0, regions: [] };
    }
    return {
      ...question,
      status: 'answered',
      score: Number(mapping.score) || 0,
      feedback: String(mapping.feedback ?? ''),
      regions: toBoundingBoxes(mapping.regions),
    };
  });

  const orphanAnswers: OrphanAnswer[] = (parsed.orphanAnswers ?? []).map(
    (orphan) => ({
      text: String(orphan?.text ?? ''),
      regions: toBoundingBoxes(orphan?.regions),
    })
  );

  return { questions: merged, orphanAnswers };
}

export async function POST(request: NextRequest) {
  let body: ExtractRequestBody;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { questionPaperPages, answerSheetPages } = body;

  if (!Array.isArray(questionPaperPages) || !Array.isArray(answerSheetPages)) {
    return Response.json(
      { error: 'questionPaperPages and answerSheetPages must both be arrays' },
      { status: 400 }
    );
  }

  if (questionPaperPages.length === 0 || answerSheetPages.length === 0) {
    return Response.json(
      { error: 'Both documents must have at least one page' },
      { status: 400 }
    );
  }

  try {
    const questions = await extractQuestions(questionPaperPages);
    const result = await extractAnswersAndMap(answerSheetPages, questions);
    return Response.json(result satisfies ExtractResponse);
  } catch (error) {
    console.error('[extract] failed:', error);
    const message =
      error instanceof ExtractionError
        ? error.message
        : 'Extraction failed. See server logs.';
    return Response.json({ error: message }, { status: 500 });
  }
}
