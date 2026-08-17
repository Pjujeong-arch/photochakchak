export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status = 0, body: unknown = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export function toErrorMessage(err: unknown, fallback = "요청에 실패했습니다.") {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  signal?: AbortSignal;
};

/**
 * JSON API helper. Secrets never belong here — only same-origin `/api/*`.
 */
export async function requestJson<T = unknown>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { method = "GET", body, signal } = options;
  let res: Response;
  try {
    res = await fetch(path, {
      method,
      credentials: "same-origin",
      signal,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("네트워크 오류입니다. 서버가 켜져 있는지 확인하세요.", 0);
  }

  const data = (await res.json().catch(() => ({}))) as {
    error?: string;
    [key: string]: unknown;
  };

  if (!res.ok) {
    throw new ApiError(
      typeof data.error === "string" ? data.error : `요청 실패 (${res.status})`,
      res.status,
      data
    );
  }

  return data as T;
}
