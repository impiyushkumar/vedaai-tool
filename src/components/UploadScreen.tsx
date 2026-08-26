"use client";

import DropZone from "./DropZone";
import type { UploadedFile } from "@/lib/store";

interface Props {
  questionPaper: UploadedFile | null;
  answerSheet: UploadedFile | null;
  error?: string | null;
  onSelect: (slot: "question" | "answer", file: File) => void;
  onClear: (slot: "question" | "answer") => void;
  onStart: () => void;
}

export default function UploadScreen({
  questionPaper,
  answerSheet,
  error,
  onSelect,
  onClear,
  onStart,
}: Props) {
  const ready = Boolean(questionPaper && answerSheet);

  return (
    <div className="flex min-h-0 flex-1 items-center justify-center overflow-y-auto px-4 py-10">
      <div className="w-full max-w-2xl">
        <div className="flex flex-col items-center text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-coral/10 text-[24px]">
            🦉
          </div>
          <h1 className="mt-5 text-[24px] font-semibold text-text">
            Upload{" "}
            <span className="text-coral underline underline-offset-4">
              Question Paper &amp; Answer Sheets
            </span>
          </h1>
          <p className="mt-2 text-[14px] text-text-secondary">
            Upload both files to get started
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row">
          <DropZone
            labelLead="Upload"
            labelAccent="Question Paper"
            file={questionPaper}
            onSelect={(f) => onSelect("question", f)}
            onClear={() => onClear("question")}
          />
          <DropZone
            labelLead="Upload"
            labelAccent="Answer Sheet"
            file={answerSheet}
            onSelect={(f) => onSelect("answer", f)}
            onClear={() => onClear("answer")}
          />
        </div>

        <div className="mt-8 flex flex-col items-center">
          {error && (
            <p className="mb-3 rounded-[8px] border border-border bg-card px-3 py-2 text-[12px] text-coral">
              {error}
            </p>
          )}
          <button
            disabled={!ready}
            onClick={onStart}
            className={`rounded-[8px] px-5 py-2.5 text-[14px] font-medium ${
              ready
                ? "bg-coral text-white"
                : "cursor-not-allowed bg-border text-text-secondary"
            }`}
          >
            Start Mapping →
          </button>
          <p className="mt-3 text-[12px] text-text-secondary">
            Once both files are uploaded, you&apos;ll be able to map answers with
            questions.
          </p>
        </div>
      </div>
    </div>
  );
}
