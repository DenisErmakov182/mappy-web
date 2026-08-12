import { useEffect } from "react";
import { PreviewSection, PreviewRow } from "./PreviewSection";
import { Icon } from "../00-foundations/Icon";
import { IconButton } from "../01-atoms/controls/IconButton";

/*
 * /components-preview — каталог библиотеки компонентов Mappy.
 * Подключается в main.tsx по window.location.pathname, без роутера —
 * в mappy-web его нет и заводить ради одной dev-страницы не стали.
 */
export function ComponentsPreviewPage() {
  useEffect(() => {
    // Тот же снятие boot-watchdog, что в App.tsx — иначе index.html решает,
    // что приложение зависло (не дождался вызова за 10с), и показывает
    // «Не удалось открыть Mappy» поверх вполне рабочей страницы превью.
    window.__MAPPY_MARK_BOOTED__?.();
  }, []);

  return (
    <div className="min-h-screen bg-neutral-100 p-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-neutral-900">Mappy Design System</h1>
          <p className="text-sm text-neutral-500">
            Каталог компонентов библиотеки. Источник — Figma, страница «01 · Атомы» и далее.
          </p>
        </header>

        <PreviewSection
          title="IconButton"
          sourcePath="src/components/design-system/01-atoms/controls/IconButton.tsx"
          description="Figma: IconButton (791:17982). Size × Tone, Pressed — через :active, Muted — через disabled."
        >
          <PreviewRow label="Size (tone=default)">
            <IconButton aria-label="Пример" icon={<Icon name="x" />} size="xs" />
            <IconButton aria-label="Пример" icon={<Icon name="x" />} size="s" />
            <IconButton aria-label="Пример" icon={<Icon name="x" />} size="m" />
            <IconButton aria-label="Пример" icon={<Icon name="x" />} size="l" />
          </PreviewRow>
          <PreviewRow label="Tone (size=m)">
            <IconButton aria-label="Пример" icon={<Icon name="plus" />} tone="default" />
            <IconButton aria-label="Пример" icon={<Icon name="plus" />} tone="ghost" />
            <IconButton aria-label="Пример" icon={<Icon name="plus" />} tone="positive" />
          </PreviewRow>
          <PreviewRow label="Иконки из реестра">
            <IconButton aria-label="Закрыть" icon={<Icon name="x" />} />
            <IconButton aria-label="Добавить" icon={<Icon name="plus" />} />
            <IconButton aria-label="Поменять местами" icon={<Icon name="swap" />} />
          </PreviewRow>
          <PreviewRow label="Disabled (нативный атрибут, не только визуал)">
            <IconButton aria-label="Пример" icon={<Icon name="x" />} tone="default" disabled />
            <IconButton aria-label="Пример" icon={<Icon name="plus" />} tone="ghost" disabled />
            <IconButton aria-label="Пример" icon={<Icon name="x" />} tone="positive" disabled />
          </PreviewRow>
        </PreviewSection>
      </div>
    </div>
  );
}
