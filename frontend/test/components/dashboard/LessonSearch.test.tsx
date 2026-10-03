import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import LessonSearch from "@/components/dashboard/LessonSearch";
import { useLearningStore } from "@/stores/learningStore";
import type { CourseDetail, LessonSearchResult } from "@/types";

const toast = vi.fn();
vi.mock("sonner", () => ({
  toast: Object.assign((...args: unknown[]) => toast(...args), { error: (...args: unknown[]) => toast(...args) }),
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
    {
      id: "m1",
      title: "Entanglement",
      order_index: 1,
      lessons: [{ id: "l1", title: "Bell States", lesson_type: "text", is_pro: false, order_index: 0 }],
    },
  ],
};

const hit = (overrides: Partial<LessonSearchResult> = {}): LessonSearchResult => ({
  lesson_id: "l0",
  lesson_title: "Qubits",
  lesson_type: "text",
  is_pro: false,
  module_id: "m0",
  module_title: "Foundations",
  course_id: "course-1",
  course_title: "Quantum Computing",
  snippet: "…a qubit is the basic unit…",
  ...overrides,
});

const searchLessons = vi.fn();
const loadCourse = vi.fn();
const loadLesson = vi.fn();

beforeEach(() => {
  toast.mockClear();
  searchLessons.mockReset();
  loadCourse.mockReset();
  loadLesson.mockReset().mockResolvedValue(undefined);
  useLearningStore.setState({
    activeCourse: course,
    lessonProgress: {},
    searchLessons,
    loadCourse,
    loadLesson,
  });
});

describe("LessonSearch", () => {
  it("does not search below two characters", async () => {
    render(<LessonSearch />);
    await userEvent.type(screen.getByRole("combobox", { name: "Search lessons" }), "q");
    await new Promise((r) => setTimeout(r, 300));
    expect(searchLessons).not.toHaveBeenCalled();
  });

  it("shows results with course, level and snippet, and opens the clicked lesson", async () => {
    searchLessons.mockResolvedValue([hit()]);
    render(<LessonSearch />);

    await userEvent.type(screen.getByRole("combobox"), "qubit");

    const option = await screen.findByRole("option", { name: /Qubits/ });
    expect(searchLessons).toHaveBeenLastCalledWith("qubit");
    expect(option).toHaveTextContent("Quantum Computing · Foundations");
    expect(option).toHaveTextContent("a qubit is the basic unit");

    await userEvent.click(option);

    expect(loadCourse).not.toHaveBeenCalled();
    expect(loadLesson).toHaveBeenCalledWith("l0");
    await waitFor(() => expect(screen.getByRole("combobox")).toHaveValue(""));
  });

  it("supports arrow-key navigation and Enter", async () => {
    searchLessons.mockResolvedValue([hit(), hit({ lesson_id: "l0b", lesson_title: "Qubit Measurement" })]);
    render(<LessonSearch />);

    const input = screen.getByRole("combobox");
    await userEvent.type(input, "qubit");
    await screen.findAllByRole("option");
    await userEvent.keyboard("{ArrowDown}{Enter}");

    expect(loadLesson).toHaveBeenCalledWith("l0b");
  });

  it("loads the other course before opening a lesson from it", async () => {
    const other: CourseDetail = { ...course, id: "course-2", title: "Algorithms" };
    loadCourse.mockImplementation(async () => useLearningStore.setState({ activeCourse: other }));
    searchLessons.mockResolvedValue([hit({ course_id: "course-2", course_title: "Algorithms" })]);
    render(<LessonSearch />);

    await userEvent.type(screen.getByRole("combobox"), "qubit");
    await userEvent.click(await screen.findByRole("option"));

    expect(loadCourse).toHaveBeenCalledWith("course-2");
    expect(loadLesson).toHaveBeenCalledWith("l0");
  });

  it("respects level locking like the sidebar", async () => {
    searchLessons.mockResolvedValue([
      hit({ lesson_id: "l1", lesson_title: "Bell States", module_id: "m1", module_title: "Entanglement" }),
    ]);
    render(<LessonSearch />);

    await userEvent.type(screen.getByRole("combobox"), "bell");
    await userEvent.click(await screen.findByRole("option"));

    expect(loadLesson).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith("Complete Level 1 to unlock Level 2");
  });

  it("shows an empty state and errors", async () => {
    searchLessons.mockResolvedValueOnce([]);
    render(<LessonSearch />);

    const input = screen.getByRole("combobox");
    await userEvent.type(input, "zz");
    expect(await screen.findByText("No lessons match “zz”")).toBeInTheDocument();

    searchLessons.mockRejectedValueOnce(new Error("Search failed hard"));
    await userEvent.type(input, "z");
    expect(await screen.findByText("Search failed hard")).toBeInTheDocument();
  });

  it("focuses on Ctrl+K", async () => {
    render(<LessonSearch />);
    await userEvent.keyboard("{Control>}k{/Control}");
    expect(screen.getByRole("combobox")).toHaveFocus();
  });
});
