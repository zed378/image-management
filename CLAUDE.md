# CLAUDE.md

This file is a short pointer for Claude. **The full operating instructions
live in [`AGENTS.md`](./AGENTS.md) -- read that file in full before doing
anything else in this repository.** Everything in `AGENTS.md` applies to
Claude with no exceptions; this file only adds Claude-specific notes so the
two never need to say the same thing twice and risk drifting apart.

## Quick orientation

- `docs/` -- the specification (318 documents, 22 categories). Start with
  `docs/README.md`.
- `TASKS/` -- the execution plan (78 tasks, 8 phases). Start with
  `TASKS/PROGRESS.md`, and read `TASKS/00-TASK-CONVENTIONS.md` before the
  first task of any session.
- `docs/ENGINEERING/` -- how code is written here. Read
  `docs/ENGINEERING/00-CODING-CONTEXT.md` (one page) before writing code;
  open `01-CODING-STANDARDS.md` while writing a specific file.
- `MEMORY/` -- the record. `MEMORY/DECISIONS.md` for why things are the way
  they are; `MEMORY/records/{TASK-ID}.md` for what happened on each task.

## Claude-specific working notes

- **Use extended thinking / planning before large multi-file changes.**
  Most tasks in `TASKS/` touch a `docs/` file, application code, and a test
  suite in the same change -- plan the full diff before writing the first
  file so the `docs/` update and the code don't drift from each other
  mid-task.
- **When a task's `Implements:` list is long, read every document before
  writing any code**, not just the first one. The image-processing and
  security documents in particular assume the reader has internalized
  cross-file constraints (e.g. a transformation parameter defined in
  `docs/API/13-IMAGE-TRANSFORMATION-API.md` must match the normalization
  function referenced by `docs/CDN/01-CACHE-KEY.md` and
  `docs/STORAGE/04-OBJECT-NAMING.md` exactly -- see `MEMORY/DECISIONS.md`
  ADR-004).
- **Prefer editing an existing "Draft specification" doc over creating a
  new one.** Every document this platform needs already has a file under
  `docs/`; if something seems missing, it's more likely under-specified in
  an existing file than genuinely absent.
- **Treat `TASKS/00-TASK-CONVENTIONS.md`'s security-critical-task rules
  (IDOR/BOLA tests) as non-negotiable**, even under time pressure or a
  request to "just get it working first." A shortcut here is the single
  most expensive kind of shortcut this specific platform can take, given
  it's explicitly multi-tenant.
- **Write the `MEMORY/records/{TASK-ID}.md` file before considering a task
  done.** A future Claude session has no memory of this one; the record is
  the only thing that carries context forward.
- If asked to work outside the `TASKS/` plan (an ad hoc request not tied to
  a task ID), it's fine -- just don't let ad hoc work silently violate a
  `docs/SECURITY/` or `docs/MULTI-TENANCY/` rule, and still consider
  whether it belongs as a new row in a `TASKS/PHASE-*.md` file rather than
  a one-off, unrecorded change.

<!-- RTK_TOKEN_SAVER_START -->
# RTK Token Saver Rule (claude)

## RTK (Rust Token Killer) Optimization Rule
Prefix every shell/terminal execution command with `rtk`:
- `rtk git status`, `rtk git diff`, `rtk git log -n 5`
- `rtk npm test`, `rtk npm run build`, `rtk pnpm test`, `rtk yarn test`
- `rtk cargo check`, `rtk cargo test`, `rtk cargo build`
- `rtk pytest`, `rtk vitest`
- `rtk ls src/`, `rtk tree -L 2`, `rtk rg "pattern"`

Keep the prefix inside chains: `rtk git add . && rtk git commit -m "msg"`.
Commands RTK has no filter for run as-is, so the prefix is always safe.

### Output & Token Optimization
Command output is condensed to save 60-90% LLM context window tokens while preserving every critical signal, error, and exit code.
- `rtk gain` / `rtk gain --history` - View token savings scoreboard.
- `rtk proxy <cmd>` - Run a command unfiltered if raw output is strictly needed.
- `RTK_DISABLED=1 <cmd>` - Skip RTK for one command.

## 3-Tier Hybrid Web Research & Scraping Policy (Upstream: fastcrw/crw & lightpanda-io/browser)
When your IDE agent receives a task requiring web research or extraction, it follows this strict 3-tier routing logic:

1. **Discovery (Tier 1 - Default Search)**:
   - The agent uses its built-in search tool (`search_web` / native search) to find target URLs or documentation links.
2. **Fast Extraction (Tier 2 - fastCRW)**:
   - The agent attempts to fetch the URL using fastCRW (`crw scrape <url>`, `crw_scrape`, or `http://127.0.0.1:3000`).
   - If the page is server-rendered (like a blog, GitHub README, or docs site), fastCRW instantly grabs clean Markdown/text, saving 70-90% context tokens without JS engine overhead.
3. **Deep Dynamic Rendering (Tier 3 - Lightpanda Local via MCP)**:
   - If fastCRW returns empty content, a rendering error, or hits a client-side JavaScript wall (e.g., a React/Vue SPA app or login-gated dashboard), the agent automatically falls back to Lightpanda Local via MCP (`lightpanda mcp`).
   - Lightpanda executes the JS via V8 and feeds a clean Accessibility Tree or Markdown back into the IDE context window using ~10x less memory than headless Chrome.


## Mandatory Semantic Knowledge Graph First Policy (Token Saver Enforcement)
Autonomous AI agents in ANY IDE MUST ALWAYS query the pre-indexed semantic knowledge graphs to provide answers BEFORE falling back to raw file reads that waste prompt tokens:

### 1. Code-Based Files -> CodeGraphContext (Upstream: CodeGraphContext/CodeGraphContext)
- **Code Query Engine:** For all code architecture, symbol definitions, function signatures, call hierarchies (callers/callees), class inheritance, and module dependencies, AI agents MUST query the CodeGraphContext index (/codegraph-query, `cgc query`, `cgc find`, or CodeGraphContext MCP tools) FIRST.
- **Zero-Waste Fallback:** NEVER dump or read entire source code files or directory trees into LLM prompt context when answering code questions. Only fall back to localized file reads (and then only targeted slices) if the knowledge graph query does not provide sufficient detail.
- **Live Synchronization:** The project code graph is continuously kept updated via background incremental sync / `cgc watch` / on-save triggers.

### 2. Non-Code Files -> JevGraph (Upstream: chenmingtang830/jevgraph)
- **Document Query Engine ONLY:** JevGraph is strictly designated for non-code files (documentation, Markdown specs, PRDs, PDFs, Word docs `.docx`, slides `.pptx`, text `.txt`).
- **Bounded Evidence:** When ingesting large specs, PRDs, PDFs, or architectural documentation, build or query bounded evidence-backed knowledge graphs (/jevgraph-build, /jevgraph-query) with character-level page maps instead of loading raw long documents into prompt context.
- **Strict Separation:** NEVER use JevGraph for source code AST indexing; code files are strictly handled by CodeGraphContext.


## Headroom Context Compression (Upstream: headroomlabs-ai/headroom)
- Utilize Headroom context compression and Compress-Cache-Retrieve (CCR) for heavy JSON structures, file reads, and tool payloads to minimize prompt tokens.


## Anti-Slop Filter & Quality Rules (Upstream: miqdadbadjuber/anti-slop)
Follow Anti-Slop rules to prevent generic AI slop in generated UI, copy, and code comments (Mode: DURING):
- **Filter, Not Style Guide:** Run purpose tests before aesthetic choices (reject ungrounded neon glows, fake metrics, generic sparkle badges).
- **Liveliness & Grounding:** Rely on `DESIGN.md` or explicit brief for design soul; enforce WCAG AA human accessibility.
- **Dedicated Skills:** Read `skills/antislop/SKILL.md` (core), `skills/antislop-ui/SKILL.md`, `skills/antislop-copywriting/SKILL.md`, `skills/antislop-human/SKILL.md`, `skills/antislop-layoutmobile/SKILL.md`, `skills/antislop-code/SKILL.md` when performing relevant tasks.


## Output & Generation Token Saver Rule (Ponytail Mode: FULL)
- **YAGNI & Shortest Diff:** Only write code that must exist. Reach for standard library before custom code or new dependencies. Shortest working diff wins.
- **Terse Responses:** Code first. At most 3 short lines of explanation: what was skipped, when to add it. No essays, no unsolicited design tours, no feature walkthroughs.

## Terse Agent Directives
- Eliminate pleasantries, greetings, and conversational filler. Provide direct answers and actionable code.
- Avoid reprinting unchanged code blocks. Use targeted search/replace blocks or concise snippets.

## Context Optimization (Compact Diffs & Outlines)
- Inspect git changes using compact single-line diffs: `rtk git diff -U1` instead of wide multi-line context.
- When exploring codebases, inspect function signatures / AST outlines (/rtk-outline) before reading entire files into context.

## Upstream Engine Integration & Latency Guardrails Standards
Whenever a new upstream engine or external tool (e.g. `fastcrw/crw`, `CodeGraphContext`, `JevGraph`) is introduced or updated:
1. **Holistic Dashboard Integration (8 Surfaces Required)**:
   - Header action toggle button (`Turn <Tool> ON / OFF`)
   - Setup alert banner (missing chips + AI install prompt generator)
   - Dedicated dashboard section & Quick Action triggers
   - Multi-channel savings breakdown navigation tabs & distribution weights
   - System Health diagnostics row with status, AI install prompt, sync, and uninstall actions
   - Upstream versions dropdown listing
   - Upstream Sync Picker (`showSyncPicker`) and Uninstall Picker (`showUninstallPicker`)
   - Footer upstream reference links
2. **Zero-Noise Latency Benchmarks**: "Test Upstream Latencies" must selectively ping and display only **installed** upstream components, silently omitting/ignoring uninstalled tools so users never see failed pings or clutter for optional tools.
3. **Footer Version Number Invariant**: The current plugin release version must always be presented beside "Token Saver" in front of "• GitHub".

<!-- RTK_TOKEN_SAVER_END -->
