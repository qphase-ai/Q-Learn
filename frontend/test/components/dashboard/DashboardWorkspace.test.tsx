import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DashboardWorkspace from "@/components/dashboard/DashboardWorkspace";
import { useLearningStore } from "@/stores/learningStore";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/stores/authStore", () => ({
  useAuthStore: { getState: () => ({ jwt: null }) },
}));

const loadCourses = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  loadCourses.mockClear();
  useLearningStore.setState({
    xp: 420,
    streak: 7,
    masteryScores: { concept1: 0.8, concept2: 0.6 },
    currentLessonId: "lesson-abc",
    lessonProgress: { "lesson-abc": 60, "lesson-def": 100 },
    courses: [],
    activeCourse: null,
    activeLesson: null,
    loadCourses,
    loadCourse: vi.fn(),
    loadLesson: vi.fn(),
    markProgress: vi.fn(),
    setCurrentLesson: vi.fn(),
    updateProgress: vi.fn(),
    updateMastery: vi.fn(),
    addXp: vi.fn(),
  });
});

describe("DashboardWorkspace", () => {
  it("shows XP in the hero strip", () => {
    render(<DashboardWorkspace />);
    expect(screen.getByText(/420/)).toBeInTheDocument();
  });

  it("shows streak in the hero strip", () => {
    render(<DashboardWorkspace />);
    expect(screen.getByText(/7 day streak/i)).toBeInTheDocument();
  });

  it("shows average mastery as a percentage", () => {
    render(<DashboardWorkspace />);
    // (0.8 + 0.6) / 2 = 0.7 → 70%
    expect(screen.getByText(/70%\s*mastery/i)).toBeInTheDocument();
  });

  it("renders a Continue link when currentLessonId is set", () => {
    render(<DashboardWorkspace />);
    expect(screen.getByRole("link", { name: /continue/i })).toBeInTheDocument();
  });

  it("renders Start Learning when no current lesson", () => {
    useLearningStore.setState({ currentLessonId: null });
    render(<DashboardWorkspace />);
    expect(screen.getByRole("link", { name: /start learning/i })).toBeInTheDocument();
  });

  it("renders the Circuit Learning track card", () => {
    render(<DashboardWorkspace />);
    expect(screen.getByText(/circuit learning/i)).toBeInTheDocument();
  });

  it("renders the Coding track card", () => {
    render(<DashboardWorkspace />);
    expect(screen.getByText(/^coding$/i)).toBeInTheDocument();
  });

  it("calls loadCourses on mount", () => {
    render(<DashboardWorkspace />);
    expect(loadCourses).toHaveBeenCalledOnce();
  });
});
