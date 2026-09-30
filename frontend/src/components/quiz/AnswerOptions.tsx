"use client";

export default function AnswerOptions({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string | null;
  onSelect: (value: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Answer options" className="mx-auto flex w-full max-w-2xl flex-col gap-2">
      {options.map((option) => (
        <label
          key={option}
          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
            selected === option
              ? "border-cyber-cyan bg-cyber-cyan/10 text-cyber-cyan"
              : "border-overlay/10 text-foreground hover:bg-overlay/5"
          }`}
        >
          <input
            type="radio"
            name="quiz-answer"
            role="radio"
            aria-checked={selected === option}
            checked={selected === option}
            onChange={() => onSelect(option)}
            className="h-4 w-4"
          />
          {option}
        </label>
      ))}
    </div>
  );
}
