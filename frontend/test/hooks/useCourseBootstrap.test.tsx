import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useCourseBootstrap } from "@/hooks/useCourseBootstrap";
import { useLearningStore } from "@/stores/learningStore";
import type { CourseDetail } from "@/types";

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

beforeEach(() => {
  loadCourses.mockClear();
  loadCourse.mockClear();
  loadLesson.mockClear();
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
});

describe("useCourseBootstrap", () => {
  it("calls loadCourses on mount", () => {
    renderHook(() => useCourseBootstrap());
    expect(loadCourses).toHaveBeenCalledOnce();
  });

  it("loads the first course once the course list arrives", async () => {
    useLearningStore.setState({
      courses: [{ id: "course-1", title: "Quantum Computing", description: null, difficulty: "beginner" }],
    });
    renderHook(() => useCourseBootstrap());
    await waitFor(() => expect(loadCourse).toHaveBeenCalledWith("course-1"));
  });

  it("auto-selects the first incomplete lesson once the course detail loads", async () => {
    useLearningStore.setState({
      courses: [{ id: "course-1", title: "Quantum Computing", description: null, difficulty: "beginner" }],
      activeCourse: course,
    });
    renderHook(() => useCourseBootstrap());
    await waitFor(() => expect(loadLesson).toHaveBeenCalledWith("l0"));
  });

  it("onRetry re-calls loadCourses", async () => {
    const { result } = renderHook(() => useCourseBootstrap());
    loadCourses.mockClear();
    result.current.onRetry();
    expect(loadCourses).toHaveBeenCalledOnce();
  });

  it("sets coursesError when loadCourses rejects, and onRetry clears it on success", async () => {
    loadCourses.mockRejectedValueOnce(new Error("network down"));
    const { result } = renderHook(() => useCourseBootstrap());

    await waitFor(() => expect(result.current.coursesError).toBe("network down"));

    result.current.onRetry();
    await waitFor(() => expect(result.current.coursesError).toBeNull());
  });

  it("sets coursesError when the course-detail fetch fails after the course list loads", async () => {
    loadCourse.mockRejectedValueOnce(new Error("course fetch failed"));
    useLearningStore.setState({
      courses: [{ id: "course-1", title: "Quantum Computing", description: null, difficulty: "beginner" }],
    });
    const { result } = renderHook(() => useCourseBootstrap());
    await waitFor(() => expect(result.current.coursesError).toBe("course fetch failed"));
  });
});
