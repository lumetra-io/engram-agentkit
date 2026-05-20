# @lumetra/engram-agentkit

Durable, explainable memory tools for [Inngest AgentKit](https://agentkit.inngest.com/) — powered by [Engram](https://lumetra.io) by Lumetra.

Drop these tools into any `createAgent({...})` and your agent gains six memory operations: store, query (semantic + graph retrieval), list, and delete.

## Install

```bash
npm install @lumetra/engram-agentkit @inngest/agent-kit zod
```

Get an API key at <https://lumetra.io>.

## Quickstart

```ts
import { createAgent, anthropic } from "@inngest/agent-kit";
import { createEngramTools } from "@lumetra/engram-agentkit";

const tools = createEngramTools({
  apiKey: process.env.ENGRAM_API_KEY!,
  bucket: "my-app",                       // optional default bucket
  // baseUrl: "https://api.lumetra.io",   // override for self-hosted
});

const agent = createAgent({
  name: "Memory-aware assistant",
  system:
    "You have durable memory. Call `query_memory` before answering anything " +
    "that might depend on prior context, and call `store_memory` whenever the " +
    "user shares a fact, preference, or decision worth remembering.",
  model: anthropic({
    model: "claude-sonnet-4-5",
    defaultParameters: { max_tokens: 32768 },
  }),
  tools,
});

const { output, toolCalls } = await agent.run(
  "Remember that my favorite framework is Inngest. Then tell me what you remembered.",
  { maxIter: 1 }  // see note below
);

console.log(output);
console.log("tool calls:", toolCalls.length);
```

> **Heads-up: `maxIter` and the Anthropic adapter (AgentKit 0.13.2).**
> If `maxIter >= 2`, AgentKit's Anthropic adapter throws `tool_use blocks can only be in assistant messages` mid-loop — the bug is in how it serializes the tool result message back to Claude. This is an **upstream AgentKit bug**, not our package. Until it's fixed, keep `maxIter: 1` for Anthropic + tool flows. OpenAI / Gemini paths aren't affected. We caught this in our e2e smoke against the published artifact.

## Tools

| Tool              | What it does                                                                 |
| ----------------- | ---------------------------------------------------------------------------- |
| `store_memory`    | Save a fact / preference / decision (`content`, `bucket?`)                   |
| `query_memory`    | Semantic + graph retrieval over a bucket (`query`, `bucket?`)                |
| `list_memories`   | Recent raw memories (`bucket?`, `limit?`)                                    |
| `list_buckets`    | All buckets visible to the API key (`limit?`, `offset?`)                     |
| `delete_memory`   | Delete by ID (`memory_id`, `bucket?`)                                        |
| `clear_memories`  | Wipe a whole bucket (`bucket?`) — destructive                                |

If you set `bucket` in `createEngramTools({ bucket: "..." })`, the agent can omit
`bucket` on every call and the default is used. Otherwise the agent must pass it
explicitly.

## Configuration

```ts
createEngramTools({
  apiKey: string,         // required (or pass `client`)
  bucket?: string,        // default bucket for tools that omit one
  baseUrl?: string,       // default "https://api.lumetra.io"
  fetch?: typeof fetch,   // custom fetch implementation
  client?: EngramClient,  // advanced: bring your own client
});
```

You can also use the raw client directly:

```ts
import { EngramClient } from "@lumetra/engram-agentkit";

const engram = new EngramClient({ apiKey: process.env.ENGRAM_API_KEY! });
await engram.store("my-app", "Jacob prefers TypeScript over JavaScript.");
const hits = await engram.query("my-app", "What does Jacob prefer?");
```

## Privacy

See [PRIVACY.md](./PRIVACY.md). The adapter sends only the tool arguments to
the Engram API; no other agent state or files leave your process.

## License

MIT - Lumetra Labs, Inc.
