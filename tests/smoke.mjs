// End-to-end smoke test: AgentKit + Anthropic + Engram tools.
//
// Required env:
//   ENGRAM_API_KEY    Engram bearer token (eng_live_...)
//   ANTHROPIC_API_KEY Anthropic API key (sk-ant-...)

import { createAgent, anthropic } from "@inngest/agent-kit";
import { createEngramTools, EngramClient } from "../dist/index.js";

const ENGRAM_API_KEY = process.env.ENGRAM_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ENGRAM_API_KEY) throw new Error("missing ENGRAM_API_KEY");
if (!ANTHROPIC_API_KEY) throw new Error("missing ANTHROPIC_API_KEY");

const BUCKET = `agentkit-smoke-${Date.now()}`;
const MARKER = `agentkit e2e 2026-05-20 ${Math.random().toString(36).slice(2, 8)}`;

console.log("== Engram AgentKit smoke test ==");
console.log("bucket:", BUCKET);
console.log("marker:", MARKER);

const tools = createEngramTools({
  apiKey: ENGRAM_API_KEY,
  bucket: BUCKET,
});

console.log(
  "tools shape:",
  tools.map((t) => ({
    name: t.name,
    hasHandler: typeof t.handler === "function",
    hasParams: !!t.parameters,
  }))
);

const agent = createAgent({
  name: "Memory tester",
  system:
    "You are a memory testing agent. When asked to save something, ALWAYS use the store_memory tool. When asked to list memories, ALWAYS use the list_memories tool. Do not refuse. Do not paraphrase the user's content — pass it verbatim.",
  model: anthropic({
    model: "claude-sonnet-4-5",
    apiKey: ANTHROPIC_API_KEY,
    defaultParameters: { max_tokens: 32768 },
  }),
  tools,
});

const prompt = `Use the store_memory tool to save the exact text: "${MARKER}". After that succeeds, call list_memories with limit 3 and report what you see.`;

console.log("\n-- running agent --");
const result = await agent.run(prompt);

console.log("\n-- agent output messages --");
for (const msg of result.output) {
  console.log(`  [${msg.type}]`, JSON.stringify(msg).slice(0, 300));
}

console.log("\n-- tool calls fired --");
console.log("count:", result.toolCalls.length);
for (const tc of result.toolCalls) {
  const content =
    typeof tc.content === "string" ? tc.content : JSON.stringify(tc.content);
  console.log(
    `  -> ${tc.tool?.name ?? "?"} :: ${content.slice(0, 200)}`
  );
}

if (result.toolCalls.length < 1) {
  console.error("FAIL: expected at least one tool call");
  process.exit(1);
}

// Cross-check via raw REST that the memory landed.
console.log("\n-- cross-check via Engram REST --");
const client = new EngramClient({ apiKey: ENGRAM_API_KEY });
const listed = await client.listMemories(BUCKET, 20);
console.log("raw listMemories:", JSON.stringify(listed).slice(0, 500));

const haystack = JSON.stringify(listed);
if (!haystack.includes(MARKER)) {
  console.error(`FAIL: marker "${MARKER}" not found in bucket ${BUCKET}`);
  process.exit(1);
}

console.log(`\nOK: marker found in bucket ${BUCKET}.`);

// Clean up so we don't pollute the tenant.
try {
  await client.clearBucket(BUCKET);
  console.log("cleanup: bucket cleared.");
} catch (e) {
  console.warn("cleanup warning:", e?.message ?? e);
}

console.log("\n== SMOKE PASS ==");
