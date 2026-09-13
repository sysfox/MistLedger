export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 py-24" role="status" aria-live="polite">
      <div className="lamp-dot" />
      <p className="text-sm text-dim">掌灯…</p>
    </div>
  );
}
