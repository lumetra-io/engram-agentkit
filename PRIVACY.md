# Privacy

This adapter sends the parameters you (or your agent) pass to its tools — `content`, `query`, `bucket`, `memory_id`, `limit`, `offset` — to the Engram REST API at `https://api.lumetra.io` (or the self-hosted base URL you configured). Memories are stored under your Engram tenant, scoped by the API key you provided to `createEngramTools({ apiKey })`.

The adapter does not collect, log, or transmit data to any third party other than the Engram service you've explicitly configured. It does not read other AgentKit state, agent history, or files — only the parameters supplied to each tool call.

For Engram's own data-handling and retention policy, see <https://lumetra.io/privacy>.
