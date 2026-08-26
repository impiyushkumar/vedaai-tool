import { GoogleGenerativeAI, type Part } from '@google/generative-ai';
import type {
  AnswersResponse,
  BoundingBox,
  ExtractedQuestion,
  OrphanAnswer,
} from '@/lib/store';

// gemini-2.5-flash returns 404 for new API keys ("no longer available to new
// users"); the API itself points at gemini-3.6-flash as the replacement.
const MODEL = process.env.GEMINI_MODEL ?? 'gemini-3.6-flash';

export class ExtractionError extends Error {}

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

export async function extractQuestions(
  pages: string[]
): Promise<ExtractedQuestion[]> {
  const raw = await callGemini(pages, QUESTIONS_PROMPT, 'extracting questions');
  const parsed = parseJsonResponse<RawQuestion[]>(raw, 'extracting questions');

  if (!Array.isArray(parsed)) {
    throw new ExtractionError('Expected a JSON array of questions from Gemini.');
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

/**
 * [yMin, xMin, yMax, xMax] at 0-1000 -> BoundingBox at 0-1.
 * `pageOffset` maps a batch-local page index back onto the whole document.
 */
function toBoundingBox(region: RawRegion, pageOffset: number): BoundingBox | null {
  const box = region?.box_2d;
  if (
    !Array.isArray(box) ||
    box.length !== 4 ||
    box.some((n) => typeof n !== 'number')
  ) {
    return null;
  }
  const [yMin, xMin, yMax, xMax] = box;
  return {
    page: (Number(region.page) || 0) + pageOffset,
    yMin: yMin / 1000,
    xMin: xMin / 1000,
    yMax: yMax / 1000,
    xMax: xMax / 1000,
  };
}

function toBoundingBoxes(
  regions: RawRegion[] | undefined,
  pageOffset: number
): BoundingBox[] {
  if (!Array.isArray(regions)) return [];
  return regions
    .map((region) => toBoundingBox(region, pageOffset))
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
    '. For each handwritten answer on these pages: match it to a question by number/label, draw a bounding box as box_2d [yMin, xMin, yMax, xMax] normalized 0-1000, score it, and write brief feedback. Return ONLY JSON, no fences: {"mappings": [{"questionId": "q1", "score": 3, "feedback": "brief feedback", "regions": [{"page": 0, "box_2d": [100, 50, 400, 950]}]}], "orphanAnswers": [{"text": "unmatched answer description", "regions": [{"page": 0, "box_2d": [500, 50, 700, 950]}]}]}. page is 0-indexed relative to the images in THIS request. If a question has no answer, omit it from mappings. Answers not matching any question go in orphanAnswers.'
  );
}

/**
 * Grades one batch of answer-sheet pages. Page indices in the result are
 * rebased onto the full document via `pageOffset`.
 */
export async function extractAnswersAndMap(
  pages: string[],
  questions: ExtractedQuestion[],
  pageOffset = 0
): Promise<AnswersResponse> {
  const raw = await callGemini(pages, mappingPrompt(questions), 'mapping answers');
  const parsed = parseJsonResponse<RawMappingResponse>(raw, 'mapping answers');

  const mappings = (parsed.mappings ?? [])
    .filter((mapping) => mapping?.questionId)
    .map((mapping) => ({
      questionId: String(mapping.questionId),
      score: Number(mapping.score) || 0,
      feedback: String(mapping.feedback ?? ''),
      regions: toBoundingBoxes(mapping.regions, pageOffset),
    }));

  const orphanAnswers: OrphanAnswer[] = (parsed.orphanAnswers ?? []).map(
    (orphan) => ({
      text: String(orphan?.text ?? ''),
      regions: toBoundingBoxes(orphan?.regions, pageOffset),
    })
  );

  return { mappings, orphanAnswers };
}
