import searchIcon from "../assets/icons/search-icon.svg";
import filterIcon from "../assets/icons/filter-icon.svg";

/*
 * Строка поиска + фильтр по макету Bar (790:16784): белый контейнер radius 32,
 * поле с асимметричными углами, справа кнопка фильтра. Тап по полю открывает
 * полноэкранный поиск (макет 1489:16146).
 */
interface Props {
  query: string;
  onOpenSearch: () => void;
  onClearQuery: () => void;
  hasActiveFilters: boolean;
  onFilterTap: () => void;
}

export function SearchFilterBar({ query, onOpenSearch, onClearQuery, hasActiveFilters, onFilterTap }: Props) {
  return (
    <div className="flex gap-1 p-2 bg-white rounded-[32px]">
      <button
        onClick={onOpenSearch}
        className="flex items-center gap-2.5 flex-1 h-12 px-4 rounded-l-[32px] rounded-r-[10px] text-left"
        style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
      >
        <img src={searchIcon} alt="" className="w-6 h-6 shrink-0" />
        <span
          className="flex-1 text-[16px] font-medium truncate"
          style={{ color: query ? "var(--mappy-text-primary)" : "var(--mappy-text-secondary)" }}
        >
          {query || "Поиск по адресу, названию"}
        </span>
        {query && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onClearQuery();
            }}
            className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
            style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
            aria-label="Очистить"
          >
            <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="#4A5565" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </span>
        )}
      </button>

      <button
        onClick={onFilterTap}
        className="relative h-12 px-4 rounded-r-[32px] rounded-l-[10px] flex items-center justify-center"
        style={{ backgroundColor: hasActiveFilters ? "var(--mappy-brand-subtle)" : "rgba(3,7,18,0.04)" }}
        aria-label="Фильтры"
      >
        <img src={filterIcon} alt="" className="w-6 h-6" />
        {hasActiveFilters && (
          <span
            className="absolute top-1.5 right-2.5 w-2 h-2 rounded-full"
            style={{ backgroundColor: "var(--mappy-pink)" }}
          />
        )}
      </button>
    </div>
  );
}
