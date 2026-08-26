export interface BoundingBox {
  page: number;
  yMin: number;
  xMin: number;
  yMax: number;
  xMax: number;
}

export interface Question {
  id: string;
  number: number;
  part?: string;
  text: string;
  score: number;
  maxScore: number;
  feedback?: string;
  regions: BoundingBox[];
  status: 'answered' | 'unanswered' | 'orphan';
}

export type AppState = 'upload' | 'processing' | 'mapping';

export interface UploadedFile {
  file: File;
  name: string;
  size: number;
  pages: number;
}

export function formatSize(bytes: number): string {
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)}KB`;
  return `${(kb / 1024).toFixed(kb / 1024 < 10 ? 1 : 0)}MB`;
}
