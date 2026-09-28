/**
 * 分区加载失败面板。
 *
 * @param onRetry 重试回调，通常直接传 `useApiData` 返回的 `reload`
 *                （签名 `() => void`，见 src/lib/api/use-api-data.ts:80）。
 *                不传则不渲染重试按钮。
 * @param label   这一栏叫什么。用于错误文案首句，也是读屏用户听到的
 *                「哪一栏坏了」的唯一线索 —— 六个一模一样的面板无法区分。
 *                默认「这一栏」，调用方强烈建议覆写。
 */
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
      {/* 「发生了什么 + 怎么办」：不写「暂时失败」这种无信息量的话。
          label 紧挨在上方 eyebrow，不必在正文里重复一遍。
          「不会重复记账」是用户点按钮前真正在犹豫的事 —— 重试走的是 GET，
          不产生任何写操作。 */}
      <p className="mt-2 text-sm leading-relaxed text-dim">
        多半是网络断了，或登录已过期。
        {onRetry ? "点下面的「重试」再取一次，不会重复记账。" : "检查网络后刷新页面再试。"}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          // .btn-ghost 自带 :focus-visible 灯色焦点环（globals.css:211），
          // 原生 <button> 自带可聚焦与 Enter/Space 激活 —— 不需要额外的键盘处理。
          className="btn-ghost mt-4"
        >
          重试
        </button>
      ) : null}
    </section>
  );
}
