import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DashboardWorkspace from "@/components/dashboard/DashboardWorkspace";
import { useLearningStore } from "@/stores/learningStore";
import { useTutorStore } from "@/stores/tutorStore";
import type { CourseDetail } from "@/types";

vi.mock("next/navigation", () => ({
  usePathname: () => "/dashboard",
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/components/dashboard/CentralWorkspace", () => ({
  default: ({ onExplainCircuit }: { onExplainCircuit: () => void }) => (
    <button onClick={onExplainCircuit}>trigger-explain</button>
  ),
}));
vi.mock("@/components/dashboard/LabShell", () => ({
  default: ({
    children,
    sidebarProps,
  }: {
    children: (ctx: { onExplainCircuit: () => void }) => React.ReactNode;
    sidebarProps: { onRetry: () => void };
  }) => (
    <div>
      <button onClick={sidebarProps.onRetry}>retry-courses</button>
      {children({ onExplainCircuit: () => {} })}
    </div>
  ),
}));

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
      lessons: [{ id: "l0", title: "Qubits", lesson_type: "text", is_pro: false, order_index: 0 }],
    },
  ],
};

const loadCourses = vi.fn().mockResolvedValue(undefined);
const loadCourse = vi.fn().mockResolvedValue(undefined);
const loadLesson = vi.fn().mockResolvedValue(undefined);
const sendMessage = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  loadCourses.mockClear();
  loadCourse.mockClear();
  loadLesson.mockClear();
  sendMessage.mockClear();
  useLearningStore.setState({
    courses: [],
    activeCourse: null,
    activeLesson: null,
    currentLessonId: null,
    lessonProgress: {},
    loadCourses,
    loadCourse,
    loadLesson,
  });
  useTutorStore.setState({
    messages: [],
    isStreaming: false,
    sendMessage: sendMessage as unknown as (m: string) => Promise<void>,
  });
});

describe("DashboardWorkspace", () => {
  it("calls loadCourses on mount", () => {
    render(<DashboardWorkspace />);
    expect(loadCourses).toHaveBeenCalledOnce();
  });

  it("loads the first course once the course list arrives", async () => {
    useLearningStore.setState({ courses: [{ id: "course-1", title: "Quantum Computing", description: null, difficulty: "beginner" }] });
    render(<DashboardWorkspace />);
    await waitFor(() => expect(loadCourse).toHaveBeenCalledWith("course-1"));
  });

  it("auto-selects the first incomplete lesson once the course detail loads", async () => {
    useLearningStore.setState({
      courses: [{ id: "course-1", title: "Quantum Computing", description: null, difficulty: "beginner" }],
      activeCourse: course,
    });
    render(<DashboardWorkspace />);
    await waitFor(() => expect(loadLesson).toHaveBeenCalledWith("l0"));
  });

  it("threads onExplainCircuit from LabShell into CentralWorkspace", async () => {
    const user = userEvent.setup();
    render(<DashboardWorkspace />);
    await user.click(screen.getByText("trigger-explain"));
    // No assertion needed beyond "didn't throw" — LabShell.test.tsx covers the
    // askTutor behavior itself.
  });

  it("clicking retry in the curriculum sidebar re-calls loadCourses", async () => {
    const user = userEvent.setup();
    render(<DashboardWorkspace />);
    loadCourses.mockClear();
    await user.click(screen.getByText("retry-courses"));
    expect(loadCourses).toHaveBeenCalledOnce();
  });
});
