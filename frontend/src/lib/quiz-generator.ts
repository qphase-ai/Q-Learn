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
  // Questions authored in the CMS take precedence over generated ones.
  const authored = quizFromBlocks(lesson);
  if (authored.length > 0) return authored;

  const concepts = lesson.concepts;

  if (concepts.length === 0) return [];

  if (concepts.length === 1) {
    return [trueFalseQuestion(concepts[0], concepts)];
  }

  // A concept without a description has no prompt text that doesn't already
  // name it, so a "which concept does this describe" question would give
  // away the answer. Fall back to a true/false question for those instead.
  return concepts.map((concept) =>
    concept.description
      ? multipleChoiceQuestion(concept, concepts)
      : trueFalseQuestion(concept, concepts)
  );
}

function quizFromBlocks(lesson: LessonDetail): QuizQuestion[] {
  return (lesson.blocks ?? []).flatMap((block, i) =>
    block.blockType === "quiz"
      ? [
          {
            id: `q-${lesson.id}-${block.id ?? i}`,
            concept_id: block.concept ?? lesson.id,
            question_text: block.question,
            question_type: block.questionType,
            options: block.options.map((o) => o.text),
            correct_answer: block.correctAnswer,
            hint: block.hint ?? "",
          },
        ]
      : []
  );
}

// Only called for concepts with a description (see generateQuizFromLesson).
function multipleChoiceQuestion(concept: ConceptOut, pool: ConceptOut[]): QuizQuestion {
  const description = concept.description!;
  const distractors = pool.filter((c) => c.id !== concept.id).map((c) => c.name);
  const options = shuffle([concept.name, ...distractors]);

  return {
    id: `q-${concept.id}`,
    concept_id: concept.id,
    question_text: `Which concept does this describe: "${description}"?`,
    question_type: "multiple_choice",
    options,
    correct_answer: concept.name,
    hint: description,
  };
}

function trueFalseQuestion(concept: ConceptOut, pool: ConceptOut[] = []): QuizQuestion {
  // When another described concept is available, sometimes swap in its
  // description so the correct answer isn't always "True".
  const others = pool.filter((c) => c.id !== concept.id && c.description);
  const isFalseStatement = others.length > 0 && Math.random() < 0.5;
  const statementSource = isFalseStatement
    ? others[Math.floor(Math.random() * others.length)]
    : concept;
  const description = statementSource.description ?? `This lesson covers ${concept.name}.`;

  return {
    id: `q-${concept.id}`,
    concept_id: concept.id,
    question_text: `True or False: "${description}" describes ${concept.name}.`,
    question_type: "true_false",
    options: ["True", "False"],
    correct_answer: isFalseStatement ? "False" : "True",
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
