import { useEffect, useState } from "react";
import { PreviewSection, PreviewRow } from "./design-system/catalog/PreviewSection";
import { Icon } from "./design-system/00-foundations/Icon";
import { IconButton } from "./design-system/01-atoms/controls/IconButton";
import { Button } from "./design-system/01-atoms/controls/Button";
import { Toggle } from "./design-system/01-atoms/controls/Toggle";
import { Chip } from "./design-system/01-atoms/controls/Chip";
import { FolderCard } from "./FolderCard";
import { FolderSearchBar } from "./FolderSearchBar";
import { FolderNameSheet } from "./FolderNameSheet";
import { FolderPickerSheet } from "./FolderPickerSheet";
import { FoldersGrid } from "./FoldersGrid";
import { useFolderActions } from "./FolderActions";
import samplePhoto from "../assets/photos/sample-cafe.jpg";

/*
 * /components-preview — каталог библиотеки компонентов Mappy.
 * Подключается в main.tsx по window.location.pathname, без роутера —
 * в mappy-web его нет и заводить ради одной dev-страницы не стали.
 *
 * Живёт в components/ (плоско, рядом с остальными экранами), а не в
 * design-system/catalog/ — это страница-обёртка с роутингом на уровне
 * приложения, не часть самой библиотеки; design-system/catalog/ оставлен
 * только для строительных блоков каталога (PreviewSection/PreviewRow).
 *
 * Защита — два уровня, разнесённые по причине (см. main.tsx для первого):
 * 1. main.tsx вообще не монтирует эту страницу, если сборка не dev-режима
 *    и не включён VITE_ENABLE_COMPONENTS_PREVIEW — на проде эта переменная
 *    никогда не выставляется, роут не существует физически.
 * 2. Здесь, внутри страницы — секретный ключ (`VITE_COMPONENTS_PREVIEW_KEY`)
 *    в query-параметре ?key=..., без него страница рендерит null (неотличимо
 *    от «такой страницы нет»). Это для стенда: флаг там включён (иначе
 *    владелец не смог бы её открыть сам), но случайный человек, узнавший
 *    URL стенда, ключа не знает.
 */
const PREVIEW_KEY_STORAGE = "mappy-ds-preview-key";

function useComponentsPreviewAccess(): boolean {
  const expectedKey = import.meta.env.VITE_COMPONENTS_PREVIEW_KEY as string | undefined;

  const [allowed, setAllowed] = useState(() => {
    if (!expectedKey) return true; // секрет не настроен (типично для локальной разработки) — второй уровень не нужен
    return localStorage.getItem(PREVIEW_KEY_STORAGE) === expectedKey;
  });

  useEffect(() => {
    if (!expectedKey || allowed) return;
    const fromUrl = new URLSearchParams(window.location.search).get("key");
    if (fromUrl !== expectedKey) return;
    localStorage.setItem(PREVIEW_KEY_STORAGE, fromUrl);
    // Ключ из адресной строки убираем сразу после того, как он сработал —
    // не оставлять его в истории браузера дольше, чем нужно.
    window.history.replaceState(null, "", window.location.pathname);
    setAllowed(true);
  }, [allowed, expectedKey]);

  return allowed;
}

/*
 * Демо для секции FolderActions ниже — тонкая обёртка вокруг реального
 * useFolderActions, той же логики, что в шапке FolderDetailScreen и на
 * карточке FolderCard. folderId фейковый: rename/delete реально бьются в
 * API, но dev-сервер здесь поднят без mappy-api, запрос просто падает по
 * сети — тот же путь, что уже обработан в хуке (шит остаётся открытым,
 * не роняет страницу), ничего не мокается отдельно ради каталога.
 */
function FolderActionsDemo() {
  const [title, setTitle] = useState("Рестораны");
  const { openMenu, sheets } = useFolderActions({
    folderId: "demo-actions",
    folderTitle: title,
    onRenamed: setTitle,
    onDeleted: () => {},
  });
  return (
    <div className="flex items-center gap-2">
      <span className="text-[14px]" style={{ color: "var(--mappy-text-secondary)" }}>
        {title}
      </span>
      <IconButton
        size="xs"
        tone="ghost"
        icon={<Icon name="dots-vertical" />}
        aria-label={`Действия с папкой «${title}»`}
        onClick={openMenu}
        className="[&_svg]:size-5"
      />
      {sheets}
    </div>
  );
}

export function ComponentsPreviewPage() {
  useEffect(() => {
    // Тот же снятие boot-watchdog, что в App.tsx — иначе index.html решает,
    // что приложение зависло (не дождался вызова за 10с), и показывает
    // «Не удалось открыть Mappy» поверх вполне рабочей страницы превью.
    window.__MAPPY_MARK_BOOTED__?.();
  }, []);

  const [toggleOn, setToggleOn] = useState(true);
  const [showFolderName, setShowFolderName] = useState(false);
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [folderSearchQuery, setFolderSearchQuery] = useState("");
  const demoFolders = [
    { id: "1", title: "Рестораны", createdAt: "", placesCount: 3, coverPhotos: [] },
    { id: "2", title: "Музеи", createdAt: "", placesCount: 1, coverPhotos: [] },
    { id: "3", title: "Италия", createdAt: "", placesCount: 5, coverPhotos: [] },
  ];
  const [chipSelected, setChipSelected] = useState<Set<string>>(new Set(["nature"]));
  const toggleChip = (key: string) =>
    setChipSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  // Хук вызывается всегда, до любого раннего return — правило хуков
  // (порядок/количество вызовов должны быть одинаковы на каждый рендер).
  const allowed = useComponentsPreviewAccess();
  if (!allowed) return null;

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
            <IconButton aria-label="Действия" icon={<Icon name="dots-vertical" />} tone="ghost" />
          </PreviewRow>
          <PreviewRow label="Disabled (нативный атрибут, не только визуал)">
            <IconButton aria-label="Пример" icon={<Icon name="x" />} tone="default" disabled />
            <IconButton aria-label="Пример" icon={<Icon name="plus" />} tone="ghost" disabled />
            <IconButton aria-label="Пример" icon={<Icon name="x" />} tone="positive" disabled />
          </PreviewRow>
        </PreviewSection>

        <PreviewSection
          title="Button"
          sourcePath="src/components/design-system/01-atoms/controls/Button.tsx"
          description="Figma: Button (1419:25008). Style × Size, Pressed — через :active, Disabled — через disabled. CTA — единственный градиентный стиль."
        >
          <PreviewRow label="Style=CTA (size=l, default)">
            <Button tone="cta" className="max-w-[280px]">
              Добавить точку
            </Button>
          </PreviewRow>
          <PreviewRow label="Style=Primary (size=l, default)">
            <Button tone="primary" className="max-w-[280px]">
              Кнопка
            </Button>
          </PreviewRow>
          <PreviewRow label="Style=Secondary (size=l, default)">
            <Button tone="secondary" className="max-w-[280px]">
              Кнопка
            </Button>
          </PreviewRow>
          <PreviewRow label="Style=Brand-Secondary (size=l, default)">
            <Button tone="brandSecondary" className="max-w-[280px]">
              Кнопка
            </Button>
          </PreviewRow>
          <PreviewRow label="Size (tone=secondary)">
            <Button tone="secondary" size="s">
              Кнопка
            </Button>
            <Button tone="secondary" size="l" className="w-auto">
              Кнопка
            </Button>
          </PreviewRow>
          <PreviewRow label="С иконками">
            <Button tone="primary" size="s" iconLeft={<Icon name="plus" />}>
              Добавить
            </Button>
            <Button tone="secondary" size="s" iconRight={<Icon name="swap" />}>
              Поменять
            </Button>
          </PreviewRow>
          <PreviewRow label="Disabled (нативный атрибут, не только визуал)">
            <Button tone="cta" size="s" disabled>
              Кнопка
            </Button>
            <Button tone="primary" size="s" disabled>
              Кнопка
            </Button>
            <Button tone="secondary" size="s" disabled>
              Кнопка
            </Button>
            <Button tone="brandSecondary" size="s" disabled>
              Кнопка
            </Button>
          </PreviewRow>
        </PreviewSection>

        <PreviewSection
          title="Toggle"
          sourcePath="src/components/design-system/01-atoms/controls/Toggle.tsx"
          description="Figma: Toggle (1796:38297). State=Default/Active — интерактивно, кликните. Disabled — своё решение, в Figma такого варианта нет."
        >
          <PreviewRow label="Интерактивный (кликните)">
            <Toggle aria-label="Пример переключателя" checked={toggleOn} onChange={setToggleOn} />
            <span className="text-sm text-neutral-500">{toggleOn ? "Active" : "Default"}</span>
          </PreviewRow>
          <PreviewRow label="Disabled (не из Figma, для согласованности с остальными атомами)">
            <Toggle aria-label="Пример" checked={false} onChange={() => {}} disabled />
            <Toggle aria-label="Пример" checked={true} onChange={() => {}} disabled />
          </PreviewRow>
        </PreviewSection>

        <PreviewSection
          title="Chip"
          sourcePath="src/components/design-system/01-atoms/controls/Chip.tsx"
          description="Figma: Chip (851:14603). State=Default/Selected — интерактивно, кликните. Size только m — ограничение самого компонента в Figma."
        >
          <PreviewRow label="Интерактивный (кликните)">
            <Chip selected={chipSelected.has("food")} onClick={() => toggleChip("food")}>
              Еда
            </Chip>
            <Chip selected={chipSelected.has("nature")} onClick={() => toggleChip("nature")}>
              Природа
            </Chip>
            <Chip selected={chipSelected.has("sport")} onClick={() => toggleChip("sport")}>
              Спорт
            </Chip>
          </PreviewRow>
          <PreviewRow label="С иконкой">
            <Chip selected={false} iconLeft={<Icon name="plus" />}>
              Добавить категорию
            </Chip>
          </PreviewRow>
          <PreviewRow label="Disabled (нативный атрибут, не только визуал)">
            <Chip selected={false} disabled>
              Кнопка
            </Chip>
            <Chip selected={true} disabled>
              Кнопка
            </Chip>
          </PreviewRow>
        </PreviewSection>

        <PreviewSection
          title="FolderCard"
          sourcePath="src/components/FolderCard.tsx"
          description="Figma: Folder (2289:43221). Собрана слоями: SVG-подложка → до трёх фотографий мест → передний карман. Геометрия в долях от макета 195×139, поэтому карточка тянется по ширине колонки."
        >
          <PreviewRow label="Пустая / с фото / со смешанными (null = заглушка)">
            <div className="grid w-full max-w-md grid-cols-2 gap-3">
              <FolderCard
                folderId="demo-1"
                title="Рестораны"
                placesCount={0}
                coverPhotos={[]}
                onClick={() => {}}
                onFolderRenamed={() => {}}
                onFolderDeleted={() => {}}
              />
              <FolderCard
                folderId="demo-2"
                title="Италия"
                placesCount={3}
                coverPhotos={[samplePhoto, samplePhoto, samplePhoto]}
                onClick={() => {}}
                onFolderRenamed={() => {}}
                onFolderDeleted={() => {}}
              />
              <FolderCard
                folderId="demo-3"
                title="Музеи"
                placesCount={3}
                coverPhotos={[samplePhoto, null, null]}
                onClick={() => {}}
                onFolderRenamed={() => {}}
                onFolderDeleted={() => {}}
              />
              <FolderCard
                folderId="demo-4"
                title="Очень длинное название папки, которое не влезает"
                placesCount={12}
                coverPhotos={[samplePhoto, samplePhoto]}
                onClick={() => {}}
                onFolderRenamed={() => {}}
                onFolderDeleted={() => {}}
              />
            </div>
          </PreviewRow>
        </PreviewSection>

        <PreviewSection
          title="FolderSearchBar"
          sourcePath="src/components/FolderSearchBar.tsx"
          description="Figma: 2289:43205. Тот же паттерн, что SearchFilterBar (790:16784): белый контейнер p-2 radius 32 с вложенным полем на --mappy-surface-secondary, без кнопки фильтра."
        >
          <PreviewRow label="Пусто / с текстом">
            <div className="flex w-full max-w-sm flex-col gap-3">
              <FolderSearchBar query="" onQueryChange={() => {}} />
              <FolderSearchBar query={folderSearchQuery} onQueryChange={setFolderSearchQuery} />
            </div>
          </PreviewRow>
        </PreviewSection>

        <PreviewSection
          title="FolderNameSheet"
          sourcePath="src/components/FolderNameSheet.tsx"
          description="Figma: 2289:41953 (подтверждён 19.08.2026 — та же 195×139 графика, что FolderCard, без выдуманного масштаба 1.583×). Название печатается прямо на графике папки — настоящий <input>, не декорация."
        >
          <PreviewRow label="Открыть шит (наложение поверх этой страницы, как поверх AddPlaceSheet)">
            <Button size="s" onClick={() => setShowFolderName(true)}>
              Показать
            </Button>
          </PreviewRow>
        </PreviewSection>

        <PreviewSection
          title="FolderPickerSheet"
          sourcePath="src/components/FolderPickerSheet.tsx"
          description="Figma: 2291:28094 (папки уже есть) / 2291:27724 (первой ещё нет — роутится на FolderNameSheet). «Новая папка» открывает FolderNameSheet ЕЩЁ одним уровнем поверх — третий вложенный Sheet, проверить намеренно."
        >
          <PreviewRow label="Открыть шит">
            <Button size="s" onClick={() => setShowFolderPicker(true)}>
              Показать
            </Button>
          </PreviewRow>
        </PreviewSection>

        <PreviewSection
          title="FolderActions"
          sourcePath="src/components/FolderActions.tsx"
          description="Меню «⋮» → «Редактировать название»/«Удалить», общая логика для шапки FolderDetailScreen и карточки FolderCard (узел 2374:12645 подтвердил кнопку в обоих местах). Кнопка здесь — точный футпринт 20×20 узла 2380:12748 (шапка «внутри папки»), с иконкой на всю коробку, без отступа — как в макете."
        >
          <PreviewRow label="Кнопка «⋮» (кликните — открывает меню редактирования/удаления)">
            <FolderActionsDemo />
          </PreviewRow>
          <PreviewRow label="Размер иконки: cva-вариант xs как есть / с оверрайдом под макет">
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-center gap-1">
                <IconButton aria-label="До" icon={<Icon name="dots-vertical" />} size="xs" tone="ghost" />
                <span className="text-[11px]" style={{ color: "var(--mappy-text-tertiary)" }}>
                  xs как есть (svg 12px)
                </span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <IconButton
                  aria-label="После"
                  icon={<Icon name="dots-vertical" />}
                  size="xs"
                  tone="ghost"
                  className="[&_svg]:size-5"
                />
                <span className="text-[11px]" style={{ color: "var(--mappy-text-tertiary)" }}>
                  + [&_svg]:size-5 (20px, узел 2380:12748)
                </span>
              </div>
            </div>
          </PreviewRow>
        </PreviewSection>

        <PreviewSection
          title="FoldersGrid"
          sourcePath="src/components/FoldersGrid.tsx"
          description="Узлы 2289:42911 (пусто) / 2293:28627 (нечётное число папок — кнопка тайлом сетки рядом с последней) / 2293:28629 (чётное число — кнопка отдельной строкой на всю ширину, последний ряд уже заполнен обеими колонками)."
        >
          <PreviewRow label="Пусто">
            <div className="h-[420px] w-full max-w-sm overflow-hidden rounded-2xl border">
              <FoldersGrid folders={[]} onOpenFolder={() => {}} onCreateFolder={() => {}} onFolderRenamed={() => {}} onFolderDeleted={() => {}} />
            </div>
          </PreviewRow>
          <PreviewRow label="1 папка, нечётное (кнопка — тайл сетки)">
            <div className="h-[420px] w-full max-w-sm overflow-hidden rounded-2xl border">
              <FoldersGrid folders={[demoFolders[0]]} onOpenFolder={() => {}} onCreateFolder={() => {}} onFolderRenamed={() => {}} onFolderDeleted={() => {}} />
            </div>
          </PreviewRow>
          <PreviewRow label="2 папки, чётное (кнопка — строка снизу)">
            <div className="h-[420px] w-full max-w-sm overflow-hidden rounded-2xl border">
              <FoldersGrid folders={demoFolders.slice(0, 2)} onOpenFolder={() => {}} onCreateFolder={() => {}} onFolderRenamed={() => {}} onFolderDeleted={() => {}} />
            </div>
          </PreviewRow>
          <PreviewRow label="3 папки, нечётное (кнопка — тайл сетки рядом с третьей)">
            <div className="h-[420px] w-full max-w-sm overflow-hidden rounded-2xl border">
              <FoldersGrid folders={demoFolders} onOpenFolder={() => {}} onCreateFolder={() => {}} onFolderRenamed={() => {}} onFolderDeleted={() => {}} />
            </div>
          </PreviewRow>
        </PreviewSection>
      </div>

      {showFolderName && (
        <FolderNameSheet
          title="Как назовем папку?"
          confirmLabel="Назвать"
          onConfirm={() => setShowFolderName(false)}
          onClose={() => setShowFolderName(false)}
        />
      )}

      {showFolderPicker && (
        <FolderPickerSheet
          folders={demoFolders}
          initialSelectedIds={["3"]}
          onCreateFolder={async (title) => ({
            id: String(Math.random()),
            title,
            createdAt: "",
            placesCount: 0,
            coverPhotos: [],
          })}
          onSave={() => setShowFolderPicker(false)}
          onClose={() => setShowFolderPicker(false)}
        />
      )}
    </div>
  );
}
