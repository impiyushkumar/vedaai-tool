"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { formatSize, type UploadedFile } from "@/lib/store";

interface Props {
  labelLead: string;
  labelAccent: string;
  file: UploadedFile | null;
  onSelect: (file: File) => void;
  onClear: () => void;
}

export default function DropZone({
  labelLead,
  labelAccent,
  file,
  onSelect,
  onClear,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(list: FileList | null) {
    const picked = list?.[0];
    if (picked) onSelect(picked);
  }

  if (file) {
    return (
      <div className="flex w-full items-center gap-3 rounded-[12px] border border-border bg-card p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-red-50 text-[12px] font-semibold text-red-600">
          PDF
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-medium text-text">
            {file.name}
          </div>
          <div className="text-[12px] text-text-secondary">
            {formatSize(file.size)} · {file.pages} Page{file.pages === 1 ? "" : "s"}
          </div>
        </div>
        <button
          onClick={onClear}
          aria-label="Clear file"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] text-text-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-[12px] border border-dashed px-6 py-10 ${
        dragging ? "border-coral bg-coral/5" : "border-border bg-card"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <Upload className="h-5 w-5 text-text-secondary" />
      <div className="text-[14px] text-text">
        {labelLead} <span className="text-coral">{labelAccent}</span>
      </div>
      <div className="text-[12px] text-text-secondary">Max 10MB</div>
    </div>
  );
}
