import type { LessonDetail, ConceptOut } from "@/types";
import type { QuizQuestion } from "@/types/quiz";

/**
 * Placeholder client-side quiz generator. There is no quiz-content backend
 * endpoint yet (no `/lessons/{id}/quiz` route exists) — this derives
 * questions from the lesson's own `concepts` so /quiz has something real to
 * quiz on. Swap this out for a `GET /api/v1/lessons/{id}/quiz` call once
 * that endpoint ships; `QuizQuestion`'s shape here is designed to match what
 * that endpoint would plausibly return, so the swap is a one-line change in
 * whichever component calls this.
 */
export function generateQuizFromLesson(lesson: LessonDetail): QuizQuestion[] {
  const concepts = lesson.concepts;

  if (concepts.length === 0) return [];

  if (concepts.length === 1) {
    return [trueFalseQuestion(concepts[0])];
  }

  return concepts.map((concept) => multipleChoiceQuestion(concept, concepts));
}

function multipleChoiceQuestion(concept: ConceptOut, pool: ConceptOut[]): QuizQuestion {
  const distractors = pool.filter((c) => c.id !== concept.id).map((c) => c.name);
  const options = shuffle([concept.name, ...distractors]);

  return {
    id: `q-${concept.id}`,
    concept_id: concept.id,
    question_text: `Which concept does this describe: "${concept.description ?? concept.name}"?`,
    question_type: "multiple_choice",
    options,
    correct_answer: concept.name,
    hint: concept.description ?? `Think about ${concept.name}.`,
  };
}

function trueFalseQuestion(concept: ConceptOut): QuizQuestion {
  return {
    id: `q-${concept.id}`,
    concept_id: concept.id,
    question_text: `True or False: ${concept.description ?? `This lesson covers ${concept.name}.`}`,
    question_type: "true_false",
    options: ["True", "False"],
    correct_answer: "True",
    hint: concept.description ?? `Think about ${concept.name}.`,
  };
}

/** Deterministic-enough shuffle for a handful of options; not cryptographic. */
function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
