/**
 * EngramClient — minimal fetch-based wrapper around the Engram REST API.
 *
 * Auth: `Authorization: Bearer eng_live_...`
 * Base URL: https://api.lumetra.io
 */

export interface EngramClientOptions {
  apiKey: string;
  baseUrl?: string;
  /** Optional fetch implementation; defaults to global `fetch`. */
  fetch?: typeof fetch;
}

export class EngramError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown, message: string) {
    super(message);
    this.name = "EngramError";
    this.status = status;
    this.body = body;
  }
}

export class EngramClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: EngramClientOptions) {
    if (!opts.apiKey) {
      throw new Error("EngramClient: `apiKey` is required.");
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? "https://api.lumetra.io").replace(/\/+$/, "");
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    if (!this.fetchImpl) {
      throw new Error(
        "EngramClient: no global `fetch` found. Provide `fetch` in options or run on Node 18+."
      );
    }
  }

  private async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<T> {
    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.apiKey}`,
      Accept: "application/json",
    };
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const res = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await res.text();
    let parsed: unknown = text;
    if (text.length > 0) {
      try {
        parsed = JSON.parse(text);
      } catch {
        // leave as raw string
      }
    }

    if (!res.ok) {
      throw new EngramError(
        res.status,
        parsed,
        `Engram ${method} ${path} failed: ${res.status} ${res.statusText}`
      );
    }
    return parsed as T;
  }

  // ---------- Memories ----------

  store(bucket: string, content: string): Promise<unknown> {
    return this.request("POST", `/v1/buckets/${encodeURIComponent(bucket)}/memories`, {
      content,
    });
  }

  /**
   * Query. NOTE: Engram's request body field is `query` (NOT `question`).
   */
  query(bucket: string, query: string): Promise<unknown> {
    return this.request("POST", `/v1/query`, { query, bucket });
  }

  listBuckets(limit = 50, offset = 0): Promise<unknown> {
    const qs = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    return this.request("GET", `/v1/buckets?${qs.toString()}`);
  }

  listMemories(bucket: string, limit = 50): Promise<unknown> {
    const qs = new URLSearchParams({ limit: String(limit) });
    return this.request(
      "GET",
      `/v1/buckets/${encodeURIComponent(bucket)}/memories?${qs.toString()}`
    );
  }

  deleteMemory(bucket: string, memoryId: string): Promise<unknown> {
    return this.request(
      "DELETE",
      `/v1/buckets/${encodeURIComponent(bucket)}/memories/${encodeURIComponent(memoryId)}`
    );
  }

  clearBucket(bucket: string): Promise<unknown> {
    return this.request(
      "DELETE",
      `/v1/buckets/${encodeURIComponent(bucket)}/memories`
    );
  }
}
