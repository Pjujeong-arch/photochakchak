import { requestJson } from "./api";
import type { RankResult } from "../types/photochak";

export type RankImagePayload = {
  id: string;
  name: string;
  mime: string;
  data: string;
};

export type RankRequest = {
  mode: "sample" | "top10";
  folder?: string;
  from?: string;
  to?: string;
  images: RankImagePayload[];
};

/** Gemini rank via server — API key stays in `.env.local` on the server. */
export function requestRank(payload: RankRequest) {
  return requestJson<RankResult>("/api/rank", {
    method: "POST",
    body: payload,
  });
}
