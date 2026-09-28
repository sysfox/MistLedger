// [D-06] 分区错误面板。
//
// 三个已删除的东西，以及为什么（先 grep 确认过 src/ 内零引用，只有 .next/ 里的
// 陈旧构建产物和审计报告还提到它们）：
//
// 1. SECTION_FAILED / catchSection —— Suspense 流式时代的遗留。那套写法是
//    「服务端组件自己 try/catch，失败返回一个哨兵值，上游渲染 null」。
//    四页改成「静态预渲染壳 + client 组件经 /api/* 取数」之后，失败发生在
//    浏览器里，catchSection 根本没有调用时机。它只是一段 11 行的死代码，
//    而死代码的成本是每次都要重新确认「这个函数还有人在用吗」。
// 2. 无参的 SectionError —— 六个一模一样的「这一栏暂时加载失败，刷新后再试」
//    面板，用户既判断不出是网络、鉴权还是服务端，也没有任何按钮，
//    唯一出路是手动 F5。useApiData 早就返回了 reload，却全站没有一个调用点。
// 3. 无 role="alert" —— 分区失败对读屏用户是完全静默的。
//
// 本组件的契约：
// - role="alert"：assertive live region，分区一失败就播报，不等用户去发现。
// - 可选 onRetry：调用点把 useApiData 的 reload 传进来。有值才渲染按钮 ——
//   没有可执行的补救动作时，按钮是装饰，不是控件。
// - 文案说清「发生了什么 + 怎么办」（DESIGN.md §十），不道歉不模糊。

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
