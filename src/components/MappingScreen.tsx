"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import type {
  BoundingBox,
  ExtractedQuestion,
  OrphanAnswer,
} from "@/lib/store";

interface Props {
  questions: ExtractedQuestion[];
  orphanAnswers: OrphanAnswer[];
  pageImages: string[];
}

/** Questions and orphans share one selection list, so normalize them. */
interface Item {
  id: string;
  label: string;
  text: string;
  feedback: string;
  regions: BoundingBox[];
  isOrphan: boolean;
  score: number;
  maxScore: number;
  answered: boolean;
}

function questionLabel(q: ExtractedQuestion): string {
  return `${q.number}${q.part ?? ""}`;
}

function scoreChipClass(item: Item): string {
  if (!item.answered || item.score === 0) return "bg-red-50 text-red-600";
  if (item.score >= item.maxScore) return "bg-green/10 text-green";
  return "bg-coral/10 text-coral";
}

export default function MappingScreen({
  questions,
  orphanAnswers,
  pageImages,
}: Props) {
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(
    null
  );
  const [currentPage, setCurrentPage] = useState(0);
  const [expandAll, setExpandAll] = useState(false);
  const [mobileTab, setMobileTab] = useState<"questions" | "sheet">("questions");

  const imageRef = useRef<HTMLImageElement>(null);
  const sheetScrollRef = useRef<HTMLDivElement>(null);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  const items = useMemo<Item[]>(() => {
    const fromQuestions: Item[] = questions.map((q) => ({
      id: q.id,
      label: questionLabel(q),
      text: q.text,
      feedback: q.feedback,
      regions: q.regions,
      isOrphan: false,
      score: q.score,
      maxScore: q.maxScore,
      answered: q.status === "answered",
    }));

    const fromOrphans: Item[] = orphanAnswers.map((orphan, index) => ({
      id: `orphan-${index}`,
      label: "Unmatched",
      text: orphan.text,
      feedback: "",
      regions: orphan.regions,
      isOrphan: true,
      score: 0,
      maxScore: 0,
      answered: true,
    }));

    return [...fromQuestions, ...fromOrphans];
  }, [questions, orphanAnswers]);

  const measure = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;
    setImageSize({ width: img.clientWidth, height: img.clientHeight });
  }, []);

  useEffect(() => {
    const img = imageRef.current;
    if (!img) return;
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(img);
    return () => observer.disconnect();
  }, [measure, currentPage, mobileTab]);

  const pageCount = pageImages.length;

  function handleSelect(item: Item) {
    setSelectedQuestionId(item.id);

    // Jump to the page holding the answer; multi-page answers land on the first.
    const target = item.regions[0];
    if (target) setCurrentPage(target.page);

    setMobileTab("sheet");

    requestAnimationFrame(() => {
      if (!target || !sheetScrollRef.current || !imageRef.current) return;
      const top = target.yMin * imageRef.current.clientHeight;
      sheetScrollRef.current.scrollTo({
        top: Math.max(0, top - 80),
        behavior: "smooth",
      });
    });
  }

  // Every answered region on this page renders; the selected one is emphasized.
  const highlights = items.flatMap((item) =>
    item.regions
      .filter((region) => region.page === currentPage)
      .map((region, index) => ({
        key: `${item.id}-${index}`,
        item,
        region,
        selected: item.id === selectedQuestionId,
      }))
  );

  const questionsPane = (
    <div className="flex min-h-0 flex-1 flex-col border-border md:border-r">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[14px] font-medium text-text">
          Extracted Questions{" "}
          <span className="text-text-secondary">(from question paper)</span>
        </h2>
        <button
          onClick={() => setExpandAll((value) => !value)}
          className="shrink-0 rounded-[8px] border border-border px-2.5 py-1 text-[12px] text-text-secondary"
        >
          {expandAll ? "Collapse All" : "Expand All"}
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          {items.map((item) => {
            const selected = item.id === selectedQuestionId;
            const expanded = expandAll || selected;
            const tinted = !item.isOrphan && !item.answered;

            return (
              <div
                key={item.id}
                onClick={() => handleSelect(item)}
                className={`cursor-pointer rounded-[10px] border border-l-[3px] px-3 py-2.5 ${
                  selected
                    ? "border-border border-l-coral bg-coral/5"
                    : tinted
                      ? "border-border border-l-transparent bg-red-50/50"
                      : "border-border border-l-transparent bg-card"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-6 shrink-0 items-center justify-center rounded-full text-[12px] font-medium ${
                      item.isOrphan
                        ? "px-2 bg-amber-100 text-amber-700"
                        : "w-6 bg-text text-white"
                    }`}
                  >
                    {item.label}
                  </div>

                  <div className="min-w-0 flex-1 truncate text-[14px] text-text">
                    {item.text}
                  </div>

                  {!item.isOrphan && (
                    <div
                      className={`shrink-0 rounded-[8px] px-2 py-0.5 text-[12px] font-medium ${scoreChipClass(item)}`}
                    >
                      {item.score}/{item.maxScore}
                    </div>
                  )}

                  {expanded ? (
                    <ChevronDown className="h-4 w-4 shrink-0 text-text-secondary" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" />
                  )}
                </div>

                {expanded && item.feedback && (
                  <div className="mt-2.5 rounded-[10px] bg-bg p-3">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-coral">
                      <Sparkles className="h-3 w-3" />
                      AI Feedback
                    </div>
                    <p className="mt-1 text-[12px] text-text-secondary">
                      {item.feedback}
                    </p>
                  </div>
                )}

                {expanded && !item.feedback && !item.isOrphan && (
                  <div className="mt-2.5 rounded-[10px] bg-bg p-3 text-[12px] text-text-secondary">
                    No answer found for this question.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const sheetPane = (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-[14px] font-medium text-text">Answer Sheet</h2>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-text-secondary">100%</span>
          <div className="flex items-center gap-1.5">
            <button
              aria-label="Previous page"
              onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
              disabled={currentPage === 0}
              className="text-text-secondary disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[12px] text-text-secondary">
              Page {pageCount === 0 ? 0 : currentPage + 1} of {pageCount}
            </span>
            <button
              aria-label="Next page"
              onClick={() =>
                setCurrentPage((p) => Math.min(pageCount - 1, p + 1))
              }
              disabled={currentPage >= pageCount - 1}
              className="text-text-secondary disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div ref={sheetScrollRef} className="min-h-0 flex-1 overflow-y-auto p-4">
        {pageImages[currentPage] ? (
          <div className="relative overflow-hidden rounded-[12px] border border-border bg-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={pageImages[currentPage]}
              alt={`Answer sheet page ${currentPage + 1}`}
              className="block w-full"
              onLoad={measure}
            />

            {imageSize.width > 0 &&
              highlights.map(({ key, item, region, selected }) => {
                const left = region.xMin * imageSize.width;
                const top = region.yMin * imageSize.height;
                const width = (region.xMax - region.xMin) * imageSize.width;
                const height = (region.yMax - region.yMin) * imageSize.height;

                const palette = item.isOrphan
                  ? {
                      border: "#F59E0B",
                      fill: "rgba(245, 158, 11, 0.12)",
                      tag: "#F59E0B",
                    }
                  : {
                      border: "#22A45D",
                      fill: "rgba(34, 164, 93, 0.12)",
                      tag: "#22A45D",
                    };

                return (
                  <div
                    key={key}
                    className="pointer-events-none absolute rounded-lg"
                    style={{
                      left,
                      top,
                      width,
                      height,
                      border: `${selected ? 3 : 2}px solid ${palette.border}`,
                      backgroundColor: palette.fill,
                      opacity: selectedQuestionId && !selected ? 0.45 : 1,
                    }}
                  >
                    <span
                      className="absolute -left-[2px] -top-[10px] rounded px-1.5 py-0.5 text-[12px] leading-tight text-white"
                      style={{ backgroundColor: palette.tag }}
                    >
                      {item.isOrphan ? "Unmatched" : `Q${item.label}`}
                    </span>
                  </div>
                );
              })}
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-[14px] text-text-secondary">
            No answer sheet pages to display.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Mobile pane switcher */}
      <div className="border-b border-border p-3 md:hidden">
        <div className="flex rounded-[10px] border border-border bg-card p-1">
          {(["questions", "sheet"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setMobileTab(tab)}
              className={`flex-1 rounded-[8px] px-3 py-1.5 text-[12px] font-medium ${
                mobileTab === tab
                  ? "bg-coral text-white"
                  : "text-text-secondary"
              }`}
            >
              {tab === "questions" ? "Questions" : "Answer Sheet"}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <div
          className={`min-h-0 flex-1 md:flex md:max-w-[440px] ${
            mobileTab === "questions" ? "flex" : "hidden"
          }`}
        >
          {questionsPane}
        </div>
        <div
          className={`min-h-0 flex-1 md:flex ${
            mobileTab === "sheet" ? "flex" : "hidden"
          }`}
        >
          {sheetPane}
        </div>
      </div>
    </div>
  );
}
