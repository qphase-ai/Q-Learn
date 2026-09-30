import type { LessonBlock, LessonBlockType } from "@/types";

export type BlockProps<T extends LessonBlockType> = Extract<LessonBlock, { blockType: T }>;
