# Q-Learn CMS — agent guide

Payload CMS (Next.js 16 / React 19) for curriculum authoring. See `README.md` and
`../docs/Curriculum/cirrculum-store-architecture.md`.

- **Ownership:** Payload owns authored content, and FastAPI owns learner state. Never add
  learner data here, and never have the CMS execute circuits or code.
- **Schema:** Payload uses only the `payload` schema. After changing a collection or block,
  run `pnpm migrate:create <name>` and commit the migration. Push is disabled.
- **Blocks:** `src/blocks/lessonBlocks.ts` is a closed registry. Changing it means changing
  `frontend/src/components/learn/blocks/` and `frontend/src/types/index.ts` in the same
  change, then running `pnpm generate:types`.
- **Circuits:** store the canonical `CircuitSpec` verbatim (`src/lib/circuitSpec.ts`), with
  no CMS-specific circuit JSON.
- **Checks:** `pnpm type-check && pnpm lint && pnpm test`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
