export default function Loading() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4" role="status" aria-live="polite">
      <div className="lamp-dot h-4 w-4" aria-hidden="true" />
      <p className="text-sm text-dim">掌灯…</p>
    </div>
  );
}
