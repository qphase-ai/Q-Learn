import { describe, it, expect, beforeEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { useLearningStore } from "@/stores/learningStore";
import { useShellStore } from "@/stores/shellStore";

// Mock child components so the test is hermetic
vi.mock("@/components/learn/LessonOutline", () => ({
  default: () => <div data-testid="lesson-outline" />,
}));
vi.mock("@/components/learn/LessonContent", () => ({
  default: () => <div data-testid="lesson-content" />,
}));
// KaTeX CSS — may be pulled in transitively
vi.mock("katex/dist/katex.min.css", () => ({}));

import LearnWorkspace from "@/components/learn/LearnWorkspace";

beforeEach(() => {
  const mockLoadCourses = vi.fn().mockResolvedValue(undefined);
  useLearningStore.setState({
    courses: [],
    activeCourse: null,
    loadCourses: mockLoadCourses as unknown as () => Promise<void>,
    loadCourse: vi.fn().mockResolvedValue(undefined) as unknown as (id: string) => Promise<void>,
  });
  useShellStore.setState({
    setFocusMode: vi.fn() as unknown as (focus: boolean) => void,
    focusMode: false,
  });
});

describe("LearnWorkspace", () => {
  it("calls loadCourses on mount", async () => {
    const { loadCourses } = useLearningStore.getState();
    render(<LearnWorkspace />);
    // Allow the effect to run
    await vi.waitFor(() => {
      expect(loadCourses).toHaveBeenCalledTimes(1);
    });
  });

  it("calls setFocusMode(false) on mount", async () => {
    const { setFocusMode } = useShellStore.getState();
    render(<LearnWorkspace />);
    await vi.waitFor(() => {
      expect(setFocusMode).toHaveBeenCalledWith(false);
    });
  });

  it("renders both LessonOutline and LessonContent", () => {
    const { getByTestId } = render(<LearnWorkspace />);
    expect(getByTestId("lesson-outline")).toBeInTheDocument();
    expect(getByTestId("lesson-content")).toBeInTheDocument();
  });

  it("calls loadCourse with the first course id when courses load and activeCourse is null", async () => {
    // Simulate: after loadCourses, courses becomes populated
    const loadCourse = vi.fn().mockResolvedValue(undefined);
    // We need loadCourses to set courses when called
    const loadCourses = vi.fn().mockImplementation(async () => {
      useLearningStore.setState({
        courses: [{ id: "course-1", title: "Quantum Foundations", description: null, difficulty: "beginner" }],
      });
    });
    useLearningStore.setState({
      courses: [],
      activeCourse: null,
      loadCourses: loadCourses as unknown as () => Promise<void>,
      loadCourse: loadCourse as unknown as (id: string) => Promise<void>,
    });

    render(<LearnWorkspace />);
    await vi.waitFor(() => {
      expect(loadCourse).toHaveBeenCalledWith("course-1");
    });
  });
});
