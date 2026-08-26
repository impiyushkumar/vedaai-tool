import type { NextRequest } from 'next/server';
import { ExtractionError, extractAnswersAndMap } from '@/lib/gemini';
import type { ExtractedQuestion } from '@/lib/store';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface Body {
  pages?: string[];
  questions?: ExtractedQuestion[];
  /** Index of this batch's first page within the full answer sheet. */
  pageOffset?: number;
}

export async function POST(request: NextRequest) {
  let body: Body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.pages) || body.pages.length === 0) {
    return Response.json(
      { error: 'pages must be a non-empty array of base64 JPEG strings' },
      { status: 400 }
    );
  }

  if (!Array.isArray(body.questions)) {
    return Response.json(
      { error: 'questions must be an array' },
      { status: 400 }
    );
  }

  try {
    const result = await extractAnswersAndMap(
      body.pages,
      body.questions,
      Number(body.pageOffset) || 0
    );
    return Response.json(result);
  } catch (error) {
    console.error('[extract-answers] failed:', error);
    return Response.json(
      {
        error:
          error instanceof ExtractionError
            ? error.message
            : 'Answer mapping failed. See server logs.',
      },
      { status: 500 }
    );
  }
}
