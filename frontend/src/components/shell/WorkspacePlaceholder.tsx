export default function WorkspacePlaceholder({
  name,
  slice,
}: {
  name: string;
  slice?: number;
}) {
  return (
    <div className="shell-fade flex h-full flex-col items-center justify-center gap-2 text-center">
      <h1 className="text-2xl font-semibold text-foreground">{name}</h1>
      <p className="text-sm text-muted-foreground">
        {slice ? `Coming in Slice ${slice}.` : "Workspace coming soon."}
      </p>
    </div>
  );
}
