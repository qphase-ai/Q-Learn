import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CurriculumSidebar from "@/components/dashboard/CurriculumSidebar";
import { useLearningStore } from "@/stores/learningStore";
import type { CourseDetail } from "@/types";

const toast = vi.fn();
vi.mock("sonner", () => ({ toast: (...args: unknown[]) => toast(...args) }));

const loadLesson = vi.fn();

const course: CourseDetail = {
  id: "course-1",
  title: "Quantum Computing",
  description: null,
  difficulty: "beginner",
  modules: [
    {
      id: "m0",
      title: "Foundations",
      order_index: 0,
      lessons: [
        { id: "l0a", title: "Qubits", lesson_type: "text", is_pro: false, order_index: 0 },
        { id: "l0b", title: "Superposition", lesson_type: "text", is_pro: false, order_index: 1 },
      ],
    },
    {
      id: "m1",
      title: "Gates and Circuits",
      order_index: 1,
      lessons: [
        { id: "l1a", title: "Single Qubit Gates", lesson_type: "text", is_pro: false, order_index: 0 },
        { id: "l1b", title: "Multi-Qubit Gates", lesson_type: "text", is_pro: false, order_index: 1 },
      ],
    },
    {
      id: "m2",
      title: "Advanced Algorithms",
      order_index: 2,
      lessons: [
        { id: "l2a", title: "Shor's Algorithm", lesson_type: "text", is_pro: true, order_index: 0 },
      ],
    },
  ],
};

beforeEach(() => {
  toast.mockClear();
  loadLesson.mockClear();
  useLearningStore.setState({
    activeCourse: course,
    currentLessonId: "l1b",
    lessonProgress: { l0a: 100, l0b: 100, l1a: 100, l1b: 40 },
    loadLesson,
  });
});

describe("CurriculumSidebar", () => {
  it("renders a row per module with level labels", () => {
    render(<CurriculumSidebar />);
    expect(screen.getByText("Level 1")).toBeInTheDocument();
    expect(screen.getByText("Level 2")).toBeInTheDocument();
    expect(screen.getByText("Level 3")).toBeInTheDocument();
  });

  it("expands the module containing the active lesson and shows its completion badge", () => {
    render(<CurriculumSidebar />);
    expect(screen.getByText("2.1 Single Qubit Gates")).toBeInTheDocument();
    expect(screen.getByText("2.2 Multi-Qubit Gates")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
  });

  it("does not show lesson rows for a locked module and toasts instead of expanding on click", async () => {
    const user = userEvent.setup();
    render(<CurriculumSidebar />);
    expect(screen.queryByText(/Shor's Algorithm/)).not.toBeInTheDocument();

    await user.click(screen.getByText("Level 3"));
    expect(toast).toHaveBeenCalled();
    expect(screen.queryByText(/Shor's Algorithm/)).not.toBeInTheDocument();
  });

  it("clicking an unlocked lesson row calls loadLesson with that lesson's id", async () => {
    const user = userEvent.setup();
    render(<CurriculumSidebar />);
    await user.click(screen.getByText("2.1 Single Qubit Gates"));
    expect(loadLesson).toHaveBeenCalledWith("l1a");
  });

  it("shows skeleton rows while loading", () => {
    useLearningStore.setState({ activeCourse: null });
    render(<CurriculumSidebar loading />);
    expect(screen.queryByText("Level 1")).not.toBeInTheDocument();
  });

  it("shows a retry affordance on error", async () => {
    const onRetry = vi.fn();
    render(<CurriculumSidebar error="boom" onRetry={onRetry} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
