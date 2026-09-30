import type { ComponentType } from "react";
import type { LessonBlock, LessonBlockType } from "@/types";
import CalloutBlock from "./CalloutBlock";
import CircuitBlock from "./CircuitBlock";
import CodeBlock from "./CodeBlock";
import HeadingBlock from "./HeadingBlock";
import ImageBlock from "./ImageBlock";
import MarkdownBlock from "./MarkdownBlock";
import MathBlock from "./MathBlock";
import QuizBlock from "./QuizBlock";
import SimulationBlock from "./SimulationBlock";
import TextBlock from "./TextBlock";
import type { BlockProps } from "./types";

/**
 * The closed block registry — mirrors cms/src/blocks/lessonBlocks.ts. Add a
 * block type in both places together.
 */
export const BlockRegistry: { [T in LessonBlockType]: ComponentType<BlockProps<T>> } = {
  heading: HeadingBlock,
  text: TextBlock,
  markdown: MarkdownBlock,
  math: MathBlock,
  image: ImageBlock,
  code: CodeBlock,
  callout: CalloutBlock,
  circuit: CircuitBlock,
  quiz: QuizBlock,
  simulation: SimulationBlock,
};

export default function LessonBlocks({ blocks }: { blocks: LessonBlock[] }) {
  return (
    <>
      {blocks.map((block, i) => {
        const Component = BlockRegistry[block.blockType] as ComponentType<LessonBlock> | undefined;
        // Unknown block types degrade, never crash.
        return Component ? <Component key={block.id ?? i} {...block} /> : null;
      })}
    </>
  );
}
