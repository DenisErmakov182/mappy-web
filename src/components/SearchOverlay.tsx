import { useEffect, useRef, useState } from "react";
import type { Place } from "../types";
import { suggestAddresses, type AddressSuggestion } from "../lib/api";
import { SearchIcon } from "./primitives";

const MIN_ADDRESS_QUERY_LENGTH = 3;
const ADDRESS_DEBOUNCE_MS = 250;

/*
 * Сортировка подсказок по расстоянию до текущего центра карты, а не по
 * relevance-порядку DaData (тот отдаёт совпадения по всей стране вперемешку,
 * см. «Некрасова» — Петербург, Омск, Казань подряд). Не через параметр
 * DaData вроде locations_boost: его точное поведение не проверить без
 * рабочего токена под рукой, а искажённая сортировка на проде хуже, чем
 * простой и понятный клиентский код.
 *
 * Не настоящее геодезическое расстояние (без синуса/косинуса Хаверсина) —
 * для одной лишь сортировки по возрастанию хватает и приближения: долгота
 * растянута по широте (градус долготы у́же градус широты ближе к полюсам),
 * остальное для ранжирования избыточно.
 */
function distanceScore(point: { lat: number; lng: number }, origin: { lat: number; lng: number }): number {
  const dLat = point.lat - origin.lat;
  const dLng = (point.lng - origin.lng) * Math.cos((origin.lat * Math.PI) / 180);
  return dLat * dLat + dLng * dLng;
}

/*
 * Открытый поиск по макету 1489:16146: белый экран, слева кнопка «назад»,
 * строка с крестиком очистки, ниже — результаты по названию/адресу.
 *
 * Кроме своих сохранённых мест ниже показываются реальные адреса из
 * геокодера DaData (те, что ещё не занесены в приложение) — выбор такого
 * адреса открывает форму добавления места сразу в этой точке.
 */
export function SearchOverlay({
  places,
  initialQuery,
  origin,
  onSubmit,
  onSelectPlace,
  onSelectAddress,
  onClose,
}: {
  places: Place[];
  initialQuery: string;
  origin: { lat: number; lng: number };
  onSubmit: (query: string) => void;
  onSelectPlace: (place: Place) => void;
  onSelectAddress: (suggestion: AddressSuggestion) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [addressResults, setAddressResults] = useState<AddressSuggestion[]>([]);
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

  useEffect(() => {
    const value = query.trim();
    if (value.length < MIN_ADDRESS_QUERY_LENGTH) {
      setAddressResults([]);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      suggestAddresses(value)
        .then((suggestions) => {
          if (!active) return;
          const sorted = [...suggestions].sort(
            (a, b) => distanceScore(a, origin) - distanceScore(b, origin),
          );
          setAddressResults(sorted);
        })
        .catch(() => {
          if (active) setAddressResults([]);
        });
    }, ADDRESS_DEBOUNCE_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query, origin]);

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
            <SearchIcon
              className="w-6 h-6 shrink-0"
              color={query ? "var(--mappy-text-primary)" : "var(--mappy-text-tertiary)"}
            />
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

        {addressResults.length > 0 && (
          <>
            {results.length > 0 && (
              <p
                className="pt-2 pb-1 text-[13px] font-medium"
                style={{ color: "var(--mappy-text-tertiary)" }}
              >
                Адреса
              </p>
            )}
            {addressResults.map((suggestion) => (
              <button
                key={`${suggestion.lat},${suggestion.lng}`}
                onClick={() => {
                  onSelectAddress(suggestion);
                  onClose();
                }}
                className="w-full text-left py-3 border-b"
                style={{ borderColor: "var(--mappy-divider)" }}
              >
                <p className="text-[16px] font-medium" style={{ color: "var(--mappy-text-primary)" }}>
                  {suggestion.label}
                </p>
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
