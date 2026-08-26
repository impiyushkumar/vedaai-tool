"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import UploadScreen from "@/components/UploadScreen";
import ProcessingScreen from "@/components/ProcessingScreen";
import MappingScreen from "@/components/MappingScreen";
import {
  API_QUALITY,
  API_SCALE,
  getPageCount,
  renderPdfPages,
  stripDataUrlPrefix,
} from "@/lib/pdf";
import type {
  AnswerMapping,
  AnswersResponse,
  AppState,
  ExtractedQuestion,
  OrphanAnswer,
  UploadedFile,
} from "@/lib/store";

/**
 * Vercel rejects request bodies over 4.5MB before the function runs, so the
 * answer sheet is sent in batches rather than one request.
 */
const PAGES_PER_BATCH = 8;

function chunk<T>(items: T[], size: number): T[][] {
  const batches: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    batches.push(items.slice(i, i + size));
  }
  return batches;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const detail = await response
      .json()
      .then((data) => data?.error)
      .catch(() => null);
    if (response.status === 413) {
      throw new Error(
        "Upload too large for the server. Try a document with fewer pages."
      );
    }
    throw new Error(detail || `Request failed (${response.status})`);
  }

  return response.json() as Promise<T>;
}

export default function Page() {
  const [state, setState] = useState<AppState>("upload");
  const [questionPaper, setQuestionPaper] = useState<UploadedFile | null>(null);
  const [answerSheet, setAnswerSheet] = useState<UploadedFile | null>(null);

  const [status, setStatus] = useState("Rendering pages...");
  const [error, setError] = useState<string | null>(null);

  // Answer sheet page images are kept as full data URLs for the mapping
  // screen to render directly into <img src>.
  const [answerSheetImages, setAnswerSheetImages] = useState<string[]>([]);
  const [questions, setQuestions] = useState<ExtractedQuestion[]>([]);
  const [orphanAnswers, setOrphanAnswers] = useState<OrphanAnswer[]>([]);

  async function handleSelect(slot: "question" | "answer", file: File) {
    const pages = await getPageCount(file);
    const uploaded: UploadedFile = {
      file,
      name: file.name,
      size: file.size,
      pages,
    };
    if (slot === "question") setQuestionPaper(uploaded);
    else setAnswerSheet(uploaded);
  }

  function handleClear(slot: "question" | "answer") {
    if (slot === "question") setQuestionPaper(null);
    else setAnswerSheet(null);
  }

  async function handleStart() {
    if (!questionPaper || !answerSheet) return;

    setError(null);
    setStatus("Rendering pages...");
    setState("processing");

    try {
      // The answer sheet is rendered twice: small for the request payload,
      // and at display scale for the mapping screen.
      const [questionPaperImages, answerImagesForApi, answerImagesForDisplay] =
        await Promise.all([
          renderPdfPages(questionPaper.file, API_SCALE, API_QUALITY),
          renderPdfPages(answerSheet.file, API_SCALE, API_QUALITY),
          renderPdfPages(answerSheet.file),
        ]);
      setAnswerSheetImages(answerImagesForDisplay);

      setStatus("Extracting questions...");

      const { questions: extracted } = await postJson<{
        questions: ExtractedQuestion[];
      }>("/api/extract-questions", {
        pages: questionPaperImages.map(stripDataUrlPrefix),
      });

      const answerPages = answerImagesForApi.map(stripDataUrlPrefix);
      const batches = chunk(answerPages, PAGES_PER_BATCH);

      const allMappings: AnswerMapping[] = [];
      const allOrphans: OrphanAnswer[] = [];

      // Sequential: batches share one rate limit, and parallel vision calls
      // over large payloads tend to trip it.
      for (let index = 0; index < batches.length; index++) {
        setStatus(
          batches.length > 1
            ? `Mapping answers... (batch ${index + 1} of ${batches.length})`
            : "Mapping answers..."
        );

        const result = await postJson<AnswersResponse>("/api/extract-answers", {
          pages: batches[index],
          questions: extracted,
          pageOffset: index * PAGES_PER_BATCH,
        });

        allMappings.push(...result.mappings);
        allOrphans.push(...result.orphanAnswers);
      }

      // An answer spanning a batch boundary yields two mappings for one
      // question; merge their regions and keep the best score.
      const byQuestionId = new Map<string, AnswerMapping>();
      for (const mapping of allMappings) {
        const existing = byQuestionId.get(mapping.questionId);
        if (!existing) {
          byQuestionId.set(mapping.questionId, { ...mapping });
          continue;
        }
        existing.regions = [...existing.regions, ...mapping.regions];
        if (mapping.score > existing.score) existing.score = mapping.score;
        if (!existing.feedback) existing.feedback = mapping.feedback;
      }

      const merged: ExtractedQuestion[] = extracted.map((question) => {
        const mapping = byQuestionId.get(question.id);
        if (!mapping) {
          return { ...question, status: "unanswered", score: 0, regions: [] };
        }
        return {
          ...question,
          status: "answered",
          score: mapping.score,
          feedback: mapping.feedback,
          regions: mapping.regions,
        };
      });

      setQuestions(merged);
      setOrphanAnswers(allOrphans);
      setState("mapping");
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error ? err.message : "Something went wrong. Try again."
      );
      setState("upload");
    }
  }

  return (
    <div className="h-screen overflow-hidden bg-bg md:pl-[220px]">
      <Sidebar />
      {/* h-screen + min-h-0 so the mapping panes scroll internally
          instead of stretching the page. */}
      <div className="flex h-screen flex-col">
        <TopBar />
        {state === "upload" && (
          <UploadScreen
            questionPaper={questionPaper}
            answerSheet={answerSheet}
            error={error}
            onSelect={handleSelect}
            onClear={handleClear}
            onStart={handleStart}
          />
        )}
        {state === "processing" && <ProcessingScreen status={status} />}
        {state === "mapping" && (
          <MappingScreen
            questions={questions}
            orphanAnswers={orphanAnswers}
            pageImages={answerSheetImages}
          />
        )}
      </div>
    </div>
  );
}
