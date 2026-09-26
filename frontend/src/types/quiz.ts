export interface QuizQuestion {
  id: string;
  concept_id: string;
  question_text: string;
  question_type: "multiple_choice" | "true_false";
  options: string[];
  correct_answer: string;
  hint: string;
}
