"use client";

import { useState } from "react";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import UploadScreen from "@/components/UploadScreen";
import ProcessingScreen from "@/components/ProcessingScreen";
import MappingScreen from "@/components/MappingScreen";
import { getPageCount, renderPdfPages, stripDataUrlPrefix } from "@/lib/pdf";
import type { AppState, UploadedFile } from "@/lib/store";
import type {
  ExtractedQuestion,
  ExtractResponse,
  OrphanAnswer,
} from "@/app/api/extract/route";

export default function Page() {
  const [state, setState] = useState<AppState>("upload");
  const [questionPaper, setQuestionPaper] = useState<UploadedFile | null>(null);
  const [answerSheet, setAnswerSheet] = useState<UploadedFile | null>(null);

  const [status, setStatus] = useState("Rendering pages...");
  const [error, setError] = useState<string | null>(null);

  // Answer sheet page images are kept as full data URLs for the Phase 5
  // mapping screen to render directly into <img src>.
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
      // Question paper is only ever sent to the API, so 1.0 is enough.
      // The answer sheet is rendered twice: 1.0 for the request payload and
      // 2.0 for the mapping screen, where boxes get zoomed into.
      const [questionPaperImages, answerImagesForApi, answerImagesForDisplay] =
        await Promise.all([
          renderPdfPages(questionPaper.file, 1.0),
          renderPdfPages(answerSheet.file, 1.0),
          renderPdfPages(answerSheet.file, 2.0),
        ]);
      setAnswerSheetImages(answerImagesForDisplay);

      setStatus("Extracting questions...");

      const response = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questionPaperPages: questionPaperImages.map(stripDataUrlPrefix),
          answerSheetPages: answerImagesForApi.map(stripDataUrlPrefix),
        }),
      });

      if (!response.ok) {
        const detail = await response
          .json()
          .then((data) => data?.error)
          .catch(() => null);
        throw new Error(detail || `Extraction request failed (${response.status})`);
      }

      setStatus("Mapping answers...");

      const result: ExtractResponse = await response.json();
      setQuestions(result.questions);
      setOrphanAnswers(result.orphanAnswers);
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
