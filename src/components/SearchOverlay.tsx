import { useEffect, useRef, useState } from "react";
import type { Place } from "../types";
import searchIcon from "../assets/icons/search-icon.svg";

/*
 * Открытый поиск по макету 1489:16146: белый экран, слева кнопка «назад»,
 * строка с крестиком очистки, ниже — результаты по названию/адресу.
 */
export function SearchOverlay({
  places,
  initialQuery,
  onSubmit,
  onSelectPlace,
  onClose,
}: {
  places: Place[];
  initialQuery: string;
  onSubmit: (query: string) => void;
  onSelectPlace: (place: Place) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const results = query.trim()
    ? places.filter(
        (p) =>
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.address.toLowerCase().includes(query.toLowerCase()),
      )
    : [];

  return (
    <div className="fixed inset-0 z-50 bg-white flex flex-col">
      {/* Единая белая капсула: [назад][поле] — по макету Bar focused (1489:16188) */}
      <div className="px-4 pt-[max(env(safe-area-inset-top),12px)] pb-2">
        <div className="flex gap-1 p-2 bg-white rounded-[32px]">
          <button
            onClick={onClose}
            className="w-[56px] h-12 rounded-l-[32px] rounded-r-[10px] flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(3,7,18,0.04)" }}
            aria-label="Назад"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M9 14L4 9L9 4" stroke="#4A5565" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 9H14.5C17.5 9 20 11.5 20 14.5C20 17.5 17.5 20 14.5 20H8" stroke="#4A5565" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <div
            className="flex items-center gap-2.5 flex-1 h-12 px-4 rounded-l-[10px] rounded-r-[32px]"
            style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
          >
            <img src={searchIcon} alt="" className="w-6 h-6 shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onSubmit(query);
                  onClose();
                }
              }}
              placeholder="Поиск по адресу, названию"
              className="flex-1 min-w-0 bg-transparent outline-none text-[16px] font-medium placeholder:text-[#99a1af]"
              style={{ color: "var(--mappy-text-primary)" }}
            />
            {query && (
              <button
                onClick={() => {
                  setQuery("");
                  inputRef.current?.focus();
                }}
                className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
                aria-label="Очистить"
              >
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <path d="M12 4L4 12M4 4L12 12" stroke="#4A5565" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        {results.map((place) => (
          <button
            key={place.id}
            onClick={() => {
              onSelectPlace(place);
              onClose();
            }}
            className="w-full text-left py-3 border-b"
            style={{ borderColor: "var(--mappy-divider)" }}
          >
            <p className="text-[16px] font-medium" style={{ color: "var(--mappy-text-primary)" }}>
              {place.title}
            </p>
            <p className="text-[13px]" style={{ color: "var(--mappy-text-secondary)" }}>
              {place.address}
            </p>
          </button>
        ))}
      </div>
    </div>
  );
}
