export default function Loading() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-6">
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-white/5 px-10 py-8 backdrop-blur-xl shadow-glow-cyan">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-cyber-cyan/30 border-t-cyber-cyan" />
        <p className="animate-pulse text-sm text-muted-foreground">Loading…</p>
      </div>
    </div>
  );
}
