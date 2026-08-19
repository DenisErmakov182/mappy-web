import { SearchIcon } from "./primitives";

/*
 * Поиск папок — узел Figma 2289:43205. Это не SearchFilterBar из карты:
 * у папок нет фильтра, а единственное поле находится внутри белой оболочки
 * 64px (8px padding + SearchField 48px). Компонент рендерится верхним
 * оверлеем App.tsx, чтобы стоять на одном уровне с поиском «Сохранённого»,
 * а не уезжать вместе с прокручиваемой сеткой.
 */
export function FolderSearchBar({ query, onQueryChange }: { query: string; onQueryChange: (query: string) => void }) {
  return (
    <label className="flex h-16 items-center rounded-[32px] bg-white p-2">
      <SearchIcon
        className="h-6 w-6 shrink-0"
        color={query ? "var(--mappy-text-primary)" : "var(--mappy-text-tertiary)"}
      />
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Поиск по папкам"
        className="ml-2.5 min-w-0 flex-1 bg-transparent text-[16px] font-medium tracking-[-0.6px] outline-none placeholder:text-[var(--mappy-text-tertiary)]"
        style={{ color: "var(--mappy-text-primary)" }}
      />
    </label>
  );
}
