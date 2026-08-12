import type { ReactNode } from "react";

/*
 * Обвязка для /components-preview. Тень, рамка, подпись пути к файлу —
 * это оформление ТОЛЬКО каталога, в реальных экранах такого нет
 * (правило библиотеки, п. 5) — специально живёт в catalog/, а не рядом
 * с настоящими компонентами.
 */
export function PreviewSection({
  title,
  sourcePath,
  description,
  children,
}: {
  title: string;
  sourcePath: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-black/10 bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.08)]">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-lg font-semibold text-neutral-900">{title}</h2>
        <code className="text-xs text-neutral-400">{sourcePath}</code>
        {description && <p className="text-sm text-neutral-500">{description}</p>}
      </div>
      <div className="flex flex-wrap items-center gap-4 rounded-xl bg-neutral-50 p-4">{children}</div>
    </section>
  );
}

export function PreviewRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-neutral-400">{label}</span>
      <div className="flex flex-wrap items-center gap-3">{children}</div>
    </div>
  );
}
