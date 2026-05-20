/**
 * createEngramTools — returns an array of AgentKit Tool instances that wrap the
 * Engram REST API. Drop them into `createAgent({ tools: [...] })`.
 *
 * Per AgentKit conventions (`@inngest/agent-kit` >= 0.13):
 *   - Schemas use Zod (`parameters: z.object({...})`)
 *   - Optional fields use `.nullable()` rather than `.optional()` so the
 *     underlying model adapters (Anthropic / OpenAI / Gemini) emit a schema
 *     they all accept.
 *   - `handler(input, { agent, network, step })` returns a value that
 *     AgentKit feeds back to the model as the tool result.
 */

import { createTool } from "@inngest/agent-kit";
import { z } from "zod";

import { EngramClient } from "./client.js";

export interface CreateEngramToolsOptions {
  /** Engram API key (`eng_live_...`). */
  apiKey: string;
  /**
   * Default bucket. When set, tools accept `bucket` as nullable and fall back
   * to this value. When unset, every tool requires `bucket` explicitly.
   */
  bucket?: string;
  /** Override the Engram API base URL (e.g. for self-hosted). */
  baseUrl?: string;
  /** Optional custom fetch (useful for testing / proxies). */
  fetch?: typeof fetch;
  /** Pre-built client; if provided overrides `apiKey`/`baseUrl`/`fetch`. */
  client?: EngramClient;
}

function resolveBucket(
  provided: string | null | undefined,
  fallback: string | undefined
): string {
  const b = provided ?? fallback;
  if (!b) {
    throw new Error(
      "Engram tool: `bucket` is required (no default bucket was configured on createEngramTools)."
    );
  }
  return b;
}

export function createEngramTools(opts: CreateEngramToolsOptions) {
  if (!opts.client && !opts.apiKey) {
    throw new Error("createEngramTools: provide either `apiKey` or `client`.");
  }
  const client =
    opts.client ??
    new EngramClient({
      apiKey: opts.apiKey,
      baseUrl: opts.baseUrl,
      fetch: opts.fetch,
    });
  const defaultBucket = opts.bucket;

  const store_memory = createTool({
    name: "store_memory",
    description:
      "Save a fact, preference, decision, or context snippet to Engram durable memory. Use this whenever the user shares something worth remembering across turns.",
    parameters: z.object({
      content: z
        .string()
        .min(1)
        .describe("The atomic fact or snippet to remember. One concept per call works best."),
      bucket: z
        .string()
        .nullable()
        .describe("Bucket to store under. Omit (null) to use the configured default."),
    }),
    handler: async ({ content, bucket }) => {
      const b = resolveBucket(bucket, defaultBucket);
      const res = await client.store(b, content);
      return { ok: true, bucket: b, result: res };
    },
  });

  const query_memory = createTool({
    name: "query_memory",
    description:
      "Search Engram memory using natural-language semantic + graph retrieval. Call this BEFORE answering any question that may depend on prior context.",
    parameters: z.object({
      query: z
        .string()
        .min(1)
        .describe("Natural-language question or topic to retrieve memories about."),
      bucket: z
        .string()
        .nullable()
        .describe("Bucket to search. Omit (null) to use the configured default."),
    }),
    handler: async ({ query, bucket }) => {
      const b = resolveBucket(bucket, defaultBucket);
      const res = await client.query(b, query);
      return res;
    },
  });

  const list_memories = createTool({
    name: "list_memories",
    description:
      "List the most recent raw memories in a bucket. Useful for debugging or summarizing what is currently stored.",
    parameters: z.object({
      bucket: z
        .string()
        .nullable()
        .describe("Bucket to list. Omit (null) to use the configured default."),
      limit: z
        .number()
        .int()
        .positive()
        .max(200)
        .nullable()
        .describe("Max memories to return (default 50)."),
    }),
    handler: async ({ bucket, limit }) => {
      const b = resolveBucket(bucket, defaultBucket);
      return await client.listMemories(b, limit ?? 50);
    },
  });

  const list_buckets = createTool({
    name: "list_buckets",
    description:
      "List Engram buckets available to this API key. Use when you don't know which bucket holds relevant memories.",
    parameters: z.object({
      limit: z.number().int().positive().max(200).nullable().describe("Max buckets to return."),
      offset: z.number().int().min(0).nullable().describe("Pagination offset."),
    }),
    handler: async ({ limit, offset }) => {
      return await client.listBuckets(limit ?? 50, offset ?? 0);
    },
  });

  const delete_memory = createTool({
    name: "delete_memory",
    description:
      "Delete a single memory by ID. Destructive — only call when the user explicitly asks to forget something.",
    parameters: z.object({
      memory_id: z.string().min(1).describe("The memory ID to delete."),
      bucket: z
        .string()
        .nullable()
        .describe("Bucket the memory lives in. Omit (null) to use the configured default."),
    }),
    handler: async ({ memory_id, bucket }) => {
      const b = resolveBucket(bucket, defaultBucket);
      return await client.deleteMemory(b, memory_id);
    },
  });

  const clear_memories = createTool({
    name: "clear_memories",
    description:
      "DESTRUCTIVE: Wipe every memory in a bucket. Only call when the user explicitly asks to reset/clear that bucket.",
    parameters: z.object({
      bucket: z
        .string()
        .nullable()
        .describe("Bucket to clear. Omit (null) to use the configured default."),
    }),
    handler: async ({ bucket }) => {
      const b = resolveBucket(bucket, defaultBucket);
      return await client.clearBucket(b);
    },
  });

  return [
    store_memory,
    query_memory,
    list_memories,
    list_buckets,
    delete_memory,
    clear_memories,
  ];
}

export type EngramTools = ReturnType<typeof createEngramTools>;
