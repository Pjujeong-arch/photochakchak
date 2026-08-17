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

export type SortPreview = {
  total: number;
  duplicates: number;
  bytesNeeded: number;
  byKind: { photo: number; video: number; other: number };
  bySource: Record<string, number>;
  items?: Array<{ key?: string; rel?: string }>;
  planFlags?: {
    skipDuplicates: boolean;
    hashVideos: boolean;
    useFallbacks: boolean;
  };
};

export type SubscribeUser = {
  email?: string;
  subscribed?: boolean;
};

export type RankItem = {
  id: string;
  rank?: number;
  genre?: string;
  name?: string;
  reason?: string;
  preview?: string;
  file?: File;
};

export type RankResult = {
  portraits?: RankItem[];
  landscapes?: RankItem[];
  top10?: RankItem[];
  nextRun?: string;
};

export type ModalView =
  | { kind: "none" }
  | { kind: "preview"; title: string; preview: SortPreview }
  | {
      kind: "done";
      title: string;
      tipKind: "folder" | "zip";
      summary: string;
      skipped: SkippedItem[];
    };

declare module "react" {
  interface CSSProperties {
    "--fill"?: string | number;
  }
}

declare global {
  interface Window {
    showDirectoryPicker(options?: {
      mode?: "read" | "readwrite";
    }): Promise<FileSystemDirectoryHandle>;
    google?: {
      accounts: {
        id: {
          initialize(opts: {
            client_id: string;
            callback: (res: { credential: string }) => void;
          }): void;
          renderButton(
            el: Element,
            opts: {
              theme?: string;
              size?: string;
              text?: string;
              shape?: string;
              width?: number;
              logo_alignment?: string;
            }
          ): void;
        };
      };
    };
  }
}

export {};
