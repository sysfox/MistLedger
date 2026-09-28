export function SectionError({
  onRetry,
  label = "这一栏",
}: {
  onRetry?: () => void;
  label?: string;
}) {
  return (
    <section className="panel p-5" role="alert">
      <p className="eyebrow">{label}</p>
      <h2 className="mt-1 font-display text-[17px] font-semibold text-ink">
        数据没取回来
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-dim">
        多半是网络断了，或登录已过期。
        {onRetry ? "点下面的「重试」再取一次，不会重复记账。" : "检查网络后刷新页面再试。"}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
// .btn-ghost 自带 :focus-visible 灯色焦点环。
          className="btn-ghost mt-4"
        >
          重试
        </button>
      ) : null}
    </section>
  );
}
