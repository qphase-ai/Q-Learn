import { describe, it, expect, vi } from "vitest";
import {
  absolutizeMedia,
  blocksToMarkdown,
  buildCourseDetail,
  buildLessonDetail,
  lessonId,
  type PayloadLesson,
} from "@/lib/cms";
import type { LessonBlock } from "@/types";

const curriculum = { id: 1, title: "Quantum Foundations", description: "Intro" };
const levels = [
  { id: 20, title: "Entanglement", levelNumber: 1, order: 0 },
  { id: 10, title: "Qubits", levelNumber: 0, order: 0 },
];
const modules = [
  { id: 101, level: 10, order: 1 },
  { id: 100, level: 10, order: 0 },
  { id: 200, level: { id: 20 }, order: 0 },
];
const lessons: PayloadLesson[] = [
  { id: 3, title: "Later in level 0", module: 101, order: 0, contentRefId: "ref-3" },
  { id: 2, title: "Second", module: 100, order: 1, contentRefId: "ref-2" },
  { id: 1, title: "First", module: 100, order: 0, contentRefId: "ref-1" },
  { id: 4, title: "Unregistered", module: 200, order: 0, contentRefId: null },
];

describe("buildCourseDetail", () => {
  const detail = buildCourseDetail(curriculum, levels, modules, lessons);

  it("maps a curriculum to a course and levels to sidebar modules, by levelNumber", () => {
    expect(detail.id).toBe("1");
    expect(detail.title).toBe("Quantum Foundations");
    expect(detail.modules.map((m) => [m.title, m.order_index])).toEqual([
      ["Qubits", 0],
      ["Entanglement", 1],
    ]);
  });

  it("lists a level's lessons in module order, then lesson order", () => {
    expect(detail.modules[0].lessons.map((l) => [l.title, l.order_index])).toEqual([
      ["First", 0],
      ["Second", 1],
      ["Later in level 0", 2],
    ]);
  });

  it("keys lessons by content ref id, falling back to payload:<id>", () => {
    expect(detail.modules[0].lessons[0].id).toBe("ref-1");
    expect(detail.modules[1].lessons[0].id).toBe("payload:4");
    expect(lessonId({ id: 9, contentRefId: undefined })).toBe("payload:9");
  });
});

describe("absolutizeMedia", () => {
  it("resolves relative upload URLs against the CMS origin and leaves others alone", () => {
    const blocks: LessonBlock[] = [
      { blockType: "image", image: { url: "/api/media/file/bloch.png", alt: "Bloch" } },
      { blockType: "image", image: { url: "https://cdn.example.com/a.png" } },
      { blockType: "image", image: 7 },
    ];
    const out = absolutizeMedia(blocks, "http://cms.local:3001");
    expect(out[0]).toMatchObject({ image: { url: "http://cms.local:3001/api/media/file/bloch.png", alt: "Bloch" } });
    expect(out[1]).toBe(blocks[1]);
    expect(out[2]).toBe(blocks[2]);
  });
});

describe("blocksToMarkdown / buildLessonDetail", () => {
  const blocks: LessonBlock[] = [
    { blockType: "heading", text: "Superposition", level: "2" },
    { blockType: "markdown", body: "A qubit is $\\alpha|0\\rangle$." },
    { blockType: "math", latex: "x^2", displayMode: true },
    { blockType: "quiz", question: "P(0)?", questionType: "true_false", options: [{ text: "a" }, { text: "b" }], correctAnswer: "a" },
    { blockType: "circuit", spec: { qubits: 1, classical_bits: 0, gates: [] } },
  ];

  it("renders a Markdown summary the tutor and lesson header can use", () => {
    expect(blocksToMarkdown(blocks)).toBe(
      "## Superposition\n\nA qubit is $\\alpha|0\\rangle$.\n\n$$\nx^2\n$$\n\nQuestion: P(0)?"
    );
  });

  it("builds a LessonDetail carrying the blocks", () => {
    const detail = buildLessonDetail(
      { id: 1, title: "Superposition", module: 100, contentRefId: "ref-1", blocks },
      "10",
      "http://cms"
    );
    expect(detail).toMatchObject({ id: "ref-1", module_id: "10", lesson_type: "quiz", concepts: [] });
    expect(detail.blocks).toHaveLength(5);
    expect(detail.content).toContain("## Superposition");
  });
});

describe("fetch id validation", () => {
  it("rejects malformed ids before calling the CMS", async () => {
    const { fetchLessonDetail, fetchCourseDetail, CmsNotFoundError } = await import("@/lib/cms");
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    await expect(fetchLessonDetail("payload:..")).rejects.toBeInstanceOf(CmsNotFoundError);
    await expect(fetchLessonDetail("not-a-uuid")).rejects.toBeInstanceOf(CmsNotFoundError);
    await expect(fetchCourseDetail("../cmsUsers")).rejects.toBeInstanceOf(CmsNotFoundError);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
