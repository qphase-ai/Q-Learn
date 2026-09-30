# Q-Learn CMS

Payload CMS for authoring the Q-Learn curriculum. It is a standalone Next.js 16 / React 19
app, kept separate from `frontend/` (Next 14) on purpose. Architecture and rationale:
[`docs/Curriculum/cirrculum-store-architecture.md`](../docs/Curriculum/cirrculum-store-architecture.md).

**Payload owns** what a lesson *is*: curriculums, levels, modules, lessons and their blocks,
and media. **FastAPI owns** what a learner *did*. The two meet only at the backend's
`content_refs` table.

## Setup

```bash
cd cms
cp .env.example .env          # fill PAYLOAD_SECRET, CMS_WEBHOOK_SECRET, REVALIDATE_SECRET
pnpm install
pnpm migrate                  # creates the `payload` schema in the shared database
pnpm dev                      # http://localhost:3001/admin
```

The first account you create in the admin becomes a **publisher**. Accounts the publisher
adds later start as **authors**. Authors can save drafts, while only publishers can publish,
unpublish, delete content, or manage users. CMS accounts are separate from Supabase student auth.

## Commands

| Command | Purpose |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Next.js on port 3001 |
| `pnpm type-check` · `pnpm lint` · `pnpm test` | Checks (Vitest unit tests in `tests/`) |
| `pnpm migrate:create <name>` | After changing a collection or block, generate a migration and commit it |
| `pnpm migrate` | Apply migrations. Production also applies pending ones on start |
| `pnpm generate:types` | Regenerate `src/payload-types.ts` |
| `pnpm generate:importmap` | Regenerate the admin import map after adding custom admin components |
| `pnpm import:legacy <file.json>` | One-off import of the legacy curriculum (see below) |

Schema push is disabled (`push: false`), so every schema change goes through a committed
migration. Alembic never touches the `payload` schema, and Payload never touches `public`.

## Layout

```
src/
  payload.config.ts       Postgres (schema `payload`, blocksAsJSON), S3 storage, collections
  collections/            Curriculums → Levels → Modules → Lessons, Media, CmsUsers
  blocks/lessonBlocks.ts  The closed 10-block registry (mirrors frontend/src/components/learn/blocks)
  lib/circuitSpec.ts      Validation for the canonical CircuitSpec (authoring UX only)
  hooks/                  Publish-role guard, content_refs registration, student-app revalidation
  migrations/             Payload migrations
scripts/import-legacy.ts  Legacy curriculum import
```

## Publishing flow

1. On publish, `registerContentRef` calls `POST {BACKEND_API_URL}/api/v1/internal/content-refs`
   with `X-CMS-Secret`. The backend returns the lesson's stable `content_refs.id` (minting it
   on the first publish), and the CMS stores it as `contentRefId`. The student app keys
   progress by this id.
2. `revalidateStudentApp` calls `POST {STUDENT_APP_URL}/api/revalidate` with
   `X-Revalidate-Secret`. The student app then drops its cached copy of the curriculum tree
   and the lesson.

Both calls are best effort, so a failure is logged and the save still goes through. A lesson
published while the backend is down has no `contentRefId` yet. It still renders, but it can't
record progress until it's published again.

## Importing the legacy curriculum

```bash
cd backend && python -m scripts.export_legacy_curriculum > legacy-curriculum.json
cd ../cms  && pnpm import:legacy ../backend/legacy-curriculum.json
```

The import maps each course to a Curriculum and each legacy module to a Level that holds one
Module. Each lesson becomes a Lesson whose Markdown is split into Markdown blocks and Circuit
blocks. Legacy `CNOT` gates are normalised to `CX`, and a missing `classical_bits` is filled
in. Each lesson's `contentRefId` is set to its legacy UUID, which binds the existing
`legacy:<uuid>` ref, so progress students already recorded is kept.

The import can be re-run safely because it only creates what is missing. It checks every
converted lesson against its source and exits non-zero on any mismatch or binding failure.
