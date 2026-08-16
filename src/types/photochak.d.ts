export type SortStats = {
  ok: number;
  estimated: number;
  unclassified: number;
  other: number;
  duplicate: number;
  error: number;
  total: number;
};

export type SortOptions = {
  useFallbacks: boolean;
  skipDuplicates: boolean;
  hashVideos: boolean;
  planItems?: unknown[] | null;
  cancelled: () => boolean;
};

export type ProgressExtra = {
  bytesWritten?: number;
  bytesTotal?: number;
};

export type SkippedItem = {
  folder: string;
  name: string;
  reason: string;
  source?: string;
};

declare global {
  interface Window {
    showDirectoryPicker(options?: { mode?: "read" | "readwrite" }): Promise<FileSystemDirectoryHandle>;
  }
}

export {};
