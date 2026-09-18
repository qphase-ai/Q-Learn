import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useLearningStore } from "@/stores/learningStore";
import type { CourseDetail } from "@/types";

import LessonOutline from "@/components/learn/LessonOutline";

const fakeCourse: CourseDetail = {
  id: "course-1",
  title: "Quantum Foundations",
  description: null,
  difficulty: "beginner",
  modules: [
    {
      id: "mod-1",
      title: "Module One",
      order_index: 0,
      lessons: [
        { id: "lesson-1", title: "Intro to Qubits", lesson_type: "text", is_pro: false, order_index: 0 },
        { id: "lesson-2", title: "Superposition", lesson_type: "text", is_pro: false, order_index: 1 },
      ],
    },
  ],
};

beforeEach(() => {
  useLearningStore.setState({
    activeCourse: fakeCourse,
    currentLessonId: "lesson-1",
    lessonProgress: { "lesson-1": 100 },
    courses: [],
    loadLesson: vi.fn().mockResolvedValue(undefined) as unknown as () => Promise<void>,
    loadCourse: vi.fn().mockResolvedValue(undefined) as unknown as (id: string) => Promise<void>,
  });
});

describe("LessonOutline", () => {
  it("renders both lesson titles", () => {
    render(<LessonOutline />);
    expect(screen.getByText("Intro to Qubits")).toBeInTheDocument();
    expect(screen.getByText("Superposition")).toBeInTheDocument();
  });

  it("renders the module title", () => {
    render(<LessonOutline />);
    expect(screen.getByText("Module One")).toBeInTheDocument();
  });

  it("calls loadLesson when a lesson is clicked", () => {
    render(<LessonOutline />);
    const loadLesson = useLearningStore.getState().loadLesson;
    fireEvent.click(screen.getByText("Superposition"));
    expect(loadLesson).toHaveBeenCalledWith("lesson-2");
  });

  it("active lesson (currentLessonId) has data-active=true and shows the cyan active-border accent", () => {
    render(<LessonOutline />);
    const activeEl = screen.getByText("Intro to Qubits").closest("[data-active='true']") as HTMLElement | null;
    expect(activeEl).not.toBeNull();
    // Active-state styling now comes from a Tailwind class (design-system token)
    // rather than a raw `var(--quantum)` inline style.
    expect(activeEl!.className).toContain("border-cyber-cyan");
  });

  it("completed lesson shows a tick indicator", () => {
    render(<LessonOutline />);
    // lesson-1 has progress 100 — should have aria-label or text tick
    const tickEl = screen.getByLabelText("completed");
    expect(tickEl).toBeInTheDocument();
  });

  it("shows empty state when activeCourse is null", () => {
    useLearningStore.setState({ activeCourse: null });
    render(<LessonOutline />);
    expect(screen.getByText(/no course loaded/i)).toBeInTheDocument();
  });
});
