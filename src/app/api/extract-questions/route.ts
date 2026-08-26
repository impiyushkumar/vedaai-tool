import type { NextRequest } from 'next/server';
import { ExtractionError, extractQuestions } from '@/lib/gemini';

export const runtime = 'nodejs';
export const maxDuration = 300;

interface Body {
  pages?: string[];
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

  try {
    const questions = await extractQuestions(body.pages);
    return Response.json({ questions });
  } catch (error) {
    console.error('[extract-questions] failed:', error);
    return Response.json(
      {
        error:
          error instanceof ExtractionError
            ? error.message
            : 'Question extraction failed. See server logs.',
      },
      { status: 500 }
    );
  }
}
