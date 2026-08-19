import { SearchIcon } from "./primitives";

/*
 * Поиск папок — узел Figma 2289:43205. Тот же паттерн, что уже есть в
 * SearchFilterBar.tsx (узел 790:16784) и в шапке FriendsScreen: белый
 * контейнер radius 32 (p-2) с вложенным полем на --mappy-surface-secondary
 * (h-12, тоже radius 32) — просто без кнопки фильтра, у папок её нет.
 * Компонент рендерится верхним оверлеем App.tsx, чтобы стоять на одном
 * уровне с поиском «Сохранённого», а не уезжать вместе с прокручиваемой
 * сеткой.
 */
export function FolderSearchBar({ query, onQueryChange }: { query: string; onQueryChange: (query: string) => void }) {
  return (
    <div className="flex gap-1 rounded-[32px] bg-white p-2">
      <label
        className="flex h-12 flex-1 items-center gap-2.5 rounded-[32px] px-4"
        style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
      >
        <SearchIcon
          className="h-6 w-6 shrink-0"
          color={query ? "var(--mappy-text-primary)" : "var(--mappy-text-tertiary)"}
        />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Поиск по папкам"
          className="min-w-0 flex-1 bg-transparent text-[16px] font-medium tracking-[-0.6px] outline-none placeholder:text-[var(--mappy-text-tertiary)]"
          style={{ color: "var(--mappy-text-primary)" }}
        />
      </label>
    </div>
  );
}
