# Frontend Layer

> Full design detail: [`frontend/design.md`](../frontend/design.md)

**Stack:** Next.js 14+ (App Router) · React 18+ · TypeScript · Tailwind CSS · Zustand · `@xyflow/react` · Monaco Editor · KaTeX · shadcn/ui · Geist + JetBrains Mono fonts

---

## Marketing Landing Page (`/`)

`app/page.tsx` is a **client component** that gates on a `qlearn-auth` cookie check. Authenticated users are redirected to `/dashboard`; everyone else sees the full marketing surface.

The page sits **outside the IDE shell** — it uses `AuroraBackground` as a full-page fixed layer and renders its own `Navbar` + `HomeFooter` instead of `AppShell`.

### Section Components (`components/home/`)

| Component | Section | Key visual primitives |
|-----------|---------|----------------------|
| `Navbar` | Sticky top nav | `MagneticButton`, shadcn `Sheet` (mobile) |
| `HeroSection` | Full-viewport hero | `ParticleNetwork`, `ShimmerText`, `GlowingBorder`, `HeroCircuitSVG` |
| `HeroCircuitSVG` | H–CNOT–Measure circuit | Static SVG, `globals.css` gate palette tokens |
| `FeaturesSection` | 6-card features grid | `StaggerContainer`, `StaggerItem`, `SpotlightCard` |
| `FeatureCard` | Single feature card | `SpotlightCard` + Lucide icon slot |
| `HowItWorksSection` | 4 alternating step rows | `SlideUp`, `SpotlightCard`, inline mockups |
| `ProbabilityMockSVG` | Probability histogram | Static SVG using design-system accent colors |
| `StatsSection` | Social proof stats bar | `MeshGradient` background |
| `HomeFooter` | 3-column minimal footer | Plain `<footer>`, Next.js `Link` |

### Auth Behavior

```
unauthenticated visitor  →  renders landing page
authenticated user       →  router.replace("/dashboard")
```

The check runs in `useEffect` on mount. `show` is `false` until the check completes, so there is no flash of marketing content for authenticated users.

`NEXT_PUBLIC_DEV_NO_AUTH=1` in development skips the cookie check and shows the page regardless (double-gated on `NODE_ENV !== "production"`).

### Responsiveness

| Breakpoint | Navbar | Feature grid | How It Works | Stats |
|-----------|--------|--------------|--------------|-------|
| `< md` | Hamburger Sheet | 1 col | Stack (visual below text) | 2×2 grid |
| `md` | Desktop links + CTAs | 2 col | Alternating rows | 4-col row |
| `lg+` | — | 3 col | — | — |

### Motion & Accessibility

All entrance animations use components from `components/motion/` (`FadeIn`, `SlideUp`, `StaggerContainer`) which internally call Framer Motion's `useReducedMotion()`. The `AuroraBackground` and `ParticleNetwork` components already carry `motion-reduce:animate-none`. The `HeroCircuitSVG` measurement gate pulse uses a CSS `@keyframes` with an explicit `@media (prefers-reduced-motion: reduce) { animation: none }` guard.

All SVGs have `aria-label` and `role="img"`. The `Navbar` uses `aria-label="Main navigation"`. All interactive elements have visible focus rings.

---

## Shell Architecture

The UI is a **persistent VS Code-style IDE shell** that mounts once. Navigation swaps only the `WorkspaceArea` — the chrome never re-renders on mode switch.

### 6 Zones

| Zone | Size | Purpose |
|------|------|---------|
| TitleBar | 36px top | Breadcrumb nav, XP progress bar, user menu |
| ActivityBar | 48px left | Icon-only mode switcher (6 modes) |
| WorkspaceArea | fills remaining | Active workspace — lazy-loaded per mode |
| RightPanel | 380px right | AI Tutor panel — collapsible (Ctrl+B) |
| BottomPanel | 250px bottom | Simulation results / console — collapsible (Ctrl+J) |
| StatusBar | 24px bottom | Current level, mastery score, backend status |

**6 Modes (ActivityBar):** Dashboard · Learn · Circuit Builder · Code Editor · Quiz / Assessment · Settings

Quiz mode activates **focus mode**: ActivityBar dims to 30%, both panels collapse. Restored on exit.

---

## Workspace Layouts

| Workspace | Layout |
|-----------|--------|
| **Dashboard** | Two-column — Learning Path Timeline (left 40%) + Skill Mastery chart, Next Activity, Recent Feed (right 60%) |
| **Learn** | Lesson Outline (left 220px) + Lesson Content (Markdown + KaTeX + inline circuit SVGs); BottomPanel auto-opens for referenced circuits |
| **Circuit Builder** | Gate Palette (left 180px) + React Flow Canvas + Circuit Toolbar; BottomPanel auto-expands on Run with Probabilities / State Vector / QASM tabs |
| **Code Editor** | File Tree (left 200px) + Monaco Editor (python3.13, Qiskit type stubs); BottomPanel = Console |
| **Quiz** | Full-width distraction-free; progress bar + question + answer options + hint button |

---

## State Management (Zustand)

Seven domain stores — no cross-store reactive subscriptions; cross-domain reads are point-in-time snapshots.

| Store | Key state |
|-------|-----------|
| `useShellStore` | `activeWorkspace`, `rightPanelOpen`, `bottomPanelOpen`, `focusMode`, `bottomPanelTab` |
| `useAuthStore` | `user`, `jwt`, `isLoading` |
| `useLearningStore` | `currentLessonId`, `lessonProgress`, `masteryScores` (BKT, 0–1), `xp`, `streak` |
| `useCircuitStore` | `nodes`, `edges`, `runState`, `results: SimulationResult` |
| `useTutorStore` | `messages`, `isStreaming`, `suggestedPrompts` |
| `useQuizStore` | `quiz`, `currentIndex`, `answers`, `score` |

**localStorage persistence:** `jwt` only (auth) · `lessonProgress`/`xp`/`streak` (learning) · `rightPanelOpen`/`bottomPanelOpen` (shell). Circuit, quiz, and tutor state are session-only.

---

## Design System Highlights

- **Color tokens:** `--bg-base #0d0d0d` · `--quantum #00d4ff` (primary accent) · `--success #3fb950` · `--error #f85149`
- **Gate colors:** H=purple · X=red · Y=orange · Z=green · CX=blue · M=cyan — consistent across palette, canvas, and QASM viewer
- **No `box-shadow`** — depth expressed via `--border` and `--quantum` glow (`0 0 8px #00d4ff40`) only
- **Typography:** Geist Mono (UI chrome) · Geist Sans (lesson prose) · JetBrains Mono (code/QASM) · KaTeX (math)

---

## Communication

- **REST** — HTTPS to FastAPI for all data operations
- **Real-time** — Supabase Realtime channels via Supabase JS SDK; subscribes to named channels (`circuit:{id}`, `tutor:{session_id}`) for circuit results, AI tutor token stream, and progress updates — no direct FastAPI `ws://` endpoints
