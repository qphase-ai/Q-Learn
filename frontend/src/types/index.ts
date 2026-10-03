export interface User {
  id: string;
  email: string;
  role: "student" | "instructor" | "admin";
}

export interface Course {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
  modules: Module[];
}

export interface Module {
  id: string;
  title: string;
  lessons: Lesson[];
}

export interface Lesson {
  id: string;
  title: string;
  lesson_type: "text" | "circuit" | "code" | "quiz";
  is_pro: boolean;
}

export type GateType =
  | "H" | "X" | "Y" | "Z" | "S" | "T" | "I"
  | "RX" | "RY" | "RZ" | "U" | "P" | "SX" | "U3"
  | "CX" | "CZ" | "SWAP" | "RXX" | "RYY" | "RZZ"
  | "M";

/** Rotation angles (radians) for parametric gates. */
export interface GateParams {
  theta?: number;
  phi?: number;
  lambda?: number;
}

export interface GateNodeData extends Record<string, unknown> {
  type: GateType;
  qubit: number;
  column: number;
  /** Second qubit of a two-qubit gate (the control for CX/CZ). */
  control?: number;
  params?: GateParams;
}

export interface GateSpec {
  type: string;
  targets: number[];
  control?: number;
  params?: Record<string, unknown>;
  classical?: number[];
}

export interface CircuitSpec {
  qubits: number;
  classical_bits: number;
  gates: GateSpec[];
}

export interface SimulationResult {
  status: string;
  probabilities: Record<string, number> | null;
  measurements: Record<string, number> | null;
  statevector: [number, number][] | null;
  qasm?: string | null;
  execution_time_ms: number | null;
  error_message?: string | null;
  id?: string;
}

export interface Plan {
  id: string;
  name: string;
  price_inr: number;
  billing_cycle: string | null;
  features: Record<string, boolean>;
}

// ---------------------------------------------------------------------------
// Learning API types (match backend Pydantic schemas exactly)
// ---------------------------------------------------------------------------

export interface CourseSummary {
  id: string;
  title: string;
  description: string | null;
  difficulty: string;
}

export interface LessonSummary {
  id: string;
  title: string;
  lesson_type: "text" | "circuit" | "code" | "quiz";
  is_pro: boolean;
  order_index: number;
}

export interface ModuleWithLessons {
  id: string;
  title: string;
  order_index: number;
  lessons: LessonSummary[];
}

export interface CourseDetail extends CourseSummary {
  modules: ModuleWithLessons[];
}

export interface LessonSearchResult {
  lesson_id: string;
  lesson_title: string;
  lesson_type: LessonSummary["lesson_type"];
  is_pro: boolean;
  module_id: string;
  module_title: string;
  course_id: string;
  course_title: string;
  snippet: string | null;
}

export interface ConceptOut {
  id: string;
  name: string;
  description: string | null;
}

export interface LessonDetail {
  id: string;
  module_id: string;
  title: string;
  content: string | null;
  lesson_type: "text" | "circuit" | "code" | "quiz";
  is_pro: boolean;
  concepts: ConceptOut[];
  /** Present when the lesson comes from the Payload CMS (see lib/cms.ts). */
  blocks?: LessonBlock[];
}

// ---------------------------------------------------------------------------
// Lesson blocks — the closed registry authored in Payload (cms/src/blocks).
// `blockType` is the discriminant; unknown types are skipped by the renderer.
// ---------------------------------------------------------------------------

interface BlockBase {
  id?: string | null;
}

export interface CmsMedia {
  url?: string | null;
  alt?: string | null;
  width?: number | null;
  height?: number | null;
}

export type LessonBlock =
  | (BlockBase & { blockType: "heading"; text: string; level: "2" | "3" | "4" })
  | (BlockBase & { blockType: "text"; body: string })
  | (BlockBase & { blockType: "markdown"; body: string })
  | (BlockBase & { blockType: "math"; latex: string; displayMode?: boolean | null; caption?: string | null })
  | (BlockBase & { blockType: "image"; image: CmsMedia | number | null; caption?: string | null })
  | (BlockBase & {
      blockType: "code";
      language: "python" | "qasm" | "text";
      code: string;
      filename?: string | null;
      caption?: string | null;
    })
  | (BlockBase & {
      blockType: "callout";
      variant: "info" | "tip" | "warning" | "important";
      title?: string | null;
      body: string;
    })
  | (BlockBase & { blockType: "circuit"; spec: CircuitSpec; title?: string | null; description?: string | null })
  | (BlockBase & {
      blockType: "quiz";
      question: string;
      questionType: "multiple_choice" | "true_false";
      options: { id?: string | null; text: string }[];
      correctAnswer: string;
      hint?: string | null;
      explanation?: string | null;
      difficulty?: string | null;
      concept?: string | null;
    })
  | (BlockBase & {
      blockType: "simulation";
      view: "probabilities" | "statevector";
      circuit: CircuitSpec;
      shots: number;
      title?: string | null;
      description?: string | null;
    });

export type LessonBlockType = LessonBlock["blockType"];

export interface ProgressItem {
  lesson_id: string;
  status: string;
  completion_pct: number;
}

// ---------------------------------------------------------------------------
// AI Tutor types (match backend app/schemas/tutor.py)
// ---------------------------------------------------------------------------

export interface Citation {
  title: string;
  url: string | null;
  score: number;
}

export interface TutorMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  /** Set when the tutor stream ended in an error (surfaced from `complete`). */
  error?: boolean;
}
