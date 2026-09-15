export const SECTION_FAILED = Symbol("section-failed");

export async function catchSection<T>(
  load: () => Promise<T>,
): Promise<T | typeof SECTION_FAILED> {
  try {
    return await load();
  } catch {
    return SECTION_FAILED;
  }
}

export function SectionError() {
  return (
    <section className="panel p-5">
      <p className="text-sm text-dim">这一栏暂时加载失败，刷新后再试</p>
    </section>
  );
}
