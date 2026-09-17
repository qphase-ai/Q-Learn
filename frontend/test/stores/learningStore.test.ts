import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CourseSummary, CourseDetail, LessonDetail, ProgressItem } from "@/types";

// ---------------------------------------------------------------------------
// Mocks — vi.mock() is hoisted; runs before any import
// ---------------------------------------------------------------------------

vi.mock("@/lib/api", () => ({
  apiFetch: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Static imports resolved after mocks
// ---------------------------------------------------------------------------
import { useLearningStore } from "@/stores/learningStore";
import { useAuthStore } from "@/stores/authStore";
import { apiFetch } from "@/lib/api";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const COURSE_SUMMARY: CourseSummary = {
  id: "course-1",
  title: "Intro to Quantum",
  description: "Learn the basics",
  difficulty: "beginner",
};

const COURSE_DETAIL: CourseDetail = {
  ...COURSE_SUMMARY,
  modules: [
    {
      id: "mod-1",
      title: "Module 1",
      order_index: 0,
      lessons: [
        {
          id: "lesson-1",
          title: "Lesson 1",
          lesson_type: "text",
          is_pro: false,
          order_index: 0,
        },
      ],
    },
  ],
};

const LESSON_DETAIL: LessonDetail = {
  id: "lesson-1",
  module_id: "mod-1",
  title: "Lesson 1",
  content: "Welcome to quantum computing.",
  lesson_type: "text",
  is_pro: false,
  concepts: [{ id: "concept-1", name: "Superposition", description: null }],
};

const PROGRESS_ITEM: ProgressItem = {
  lesson_id: "lesson-1",
  status: "completed",
  completion_pct: 100,
};

// ---------------------------------------------------------------------------
// Reset state between tests
// ---------------------------------------------------------------------------
beforeEach(() => {
  useLearningStore.setState({
    courses: [],
    activeCourse: null,
    activeLesson: null,
    currentLessonId: null,
    lessonProgress: {},
    masteryScores: {},
    xp: 0,
    streak: 0,
  });

  useAuthStore.setState({ jwt: "t", user: null, isLoading: false });

  vi.clearAllMocks();
});

// ---------------------------------------------------------------------------
// loadCourses
// ---------------------------------------------------------------------------
describe("loadCourses", () => {
  it("sets courses from the apiFetch return and calls /api/v1/courses", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce([COURSE_SUMMARY]);

    await useLearningStore.getState().loadCourses();

    expect(useLearningStore.getState().courses).toEqual([COURSE_SUMMARY]);
    expect(apiFetch).toHaveBeenCalledOnce();
    const [path, opts] = vi.mocked(apiFetch).mock.calls[0];
    expect(path).toBe("/api/v1/courses");
    expect(opts?.token).toBe("t");
  });
});

// ---------------------------------------------------------------------------
// loadLesson
// ---------------------------------------------------------------------------
describe("loadLesson", () => {
  it("sets activeLesson and currentLessonId when called with a lesson id", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(LESSON_DETAIL);

    await useLearningStore.getState().loadLesson("lesson-1");

    const state = useLearningStore.getState();
    expect(state.activeLesson).toEqual(LESSON_DETAIL);
    expect(state.currentLessonId).toBe("lesson-1");
    const [path, opts] = vi.mocked(apiFetch).mock.calls[0];
    expect(path).toBe("/api/v1/lessons/lesson-1");
    expect(opts?.token).toBe("t");
  });
});

// ---------------------------------------------------------------------------
// markProgress
// ---------------------------------------------------------------------------
describe("markProgress", () => {
  it("optimistically sets lessonProgress and PUTs with status='completed' when pct=100", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(PROGRESS_ITEM);

    await useLearningStore.getState().markProgress("lesson-1", 100);

    // Optimistic update is visible
    expect(useLearningStore.getState().lessonProgress["lesson-1"]).toBe(100);

    // PUT called with correct path and body
    expect(apiFetch).toHaveBeenCalledOnce();
    const [path, opts] = vi.mocked(apiFetch).mock.calls[0];
    expect(path).toBe("/api/v1/lessons/lesson-1/progress");
    expect(opts?.method).toBe("PUT");
    expect(opts?.token).toBe("t");
    const body = JSON.parse(opts?.body as string);
    expect(body.status).toBe("completed");
    expect(body.completion_pct).toBe(100);
  });

  it("uses status='in_progress' when pct < 100", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce({
      lesson_id: "lesson-1",
      status: "in_progress",
      completion_pct: 50,
    });

    await useLearningStore.getState().markProgress("lesson-1", 50);

    const [, opts] = vi.mocked(apiFetch).mock.calls[0];
    const body = JSON.parse(opts?.body as string);
    expect(body.status).toBe("in_progress");
    expect(body.completion_pct).toBe(50);
  });
});
