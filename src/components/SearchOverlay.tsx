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
 * Ранг совпадения своего места с запросом — раньше список фильтровался, но
 * не сортировался вовсе: место оставалось в исходном порядке `places»
 * (по дате создания), даже если это точное совпадение по названию, а выше
 * него — место, совпавшее только частью адреса. Владелец заметил на примере:
 * «мама рома» не оказывалась первой в списке, хотя набранный текст ей и
 * соответствовал точнее всего.
 *
 * Меньше — релевантнее. Совпадение по названию всегда выше совпадения только
 * по адресу, а внутри — точное/с начала слова важнее совпадения где-то в середине.
 */
function placeMatchRank(place: Place, query: string): number {
  const title = place.title.toLowerCase();
  const address = place.address.toLowerCase();
  if (title === query) return 0;
  if (title.startsWith(query)) return 1;
  if (title.split(/\s+/).some((word) => word.startsWith(query))) return 2;
  if (title.includes(query)) return 3;
  if (address.startsWith(query)) return 4;
  return 5; // совпало только где-то внутри адреса
}

// Административные сегменты label, которые ничего не говорят человеку и
// только удлиняют строку — федеральный округ и страна почти всегда есть в
// конце ответа Nominatim/DaData, но их не показывают ни Яндекс.Карты, ни
// 2ГИС (владелец прислал скриншоты сравнения, этап 66).
const NOISY_LABEL_SEGMENT = /федеральный округ|^Россия$/i;
// Сегменты только из цифр — почтовый индекс.
const NUMERIC_ONLY_SEGMENT = /^\d+$/;

/*
 * Nominatim/DaData отдают адрес одной длинной строкой со всей
 * административной цепочкой целиком («Мама Рома, проспект Славы, округ
 * Купчино, Санкт-Петербург, Северо-Западный федеральный округ, 192286,
 * Россия») — читать это на маленьком экране неудобно, а у Яндекс.Карт и
 * 2ГИС результат короткий: название + район, город. Делим на то же самое:
 * первый сегмент — заголовок (сам объект), из оставшихся выбрасываем индекс,
 * страну и федеральный округ, и берём последние два сегмента, что остались —
 * это и есть «район, город» в подавляющем большинстве российских адресов.
 * Не идеальная геокодерная логика (для нестандартных зарубежных цепочек
 * ориентир может оказаться на уровень выше или ниже), но эта же неточность
 * уже была бы и в исходной строке — здесь только короче.
 */
function splitAddressLabel(label: string): { title: string; context: string } {
  const segments = label.split(",").map((s) => s.trim());
  const [title, ...rest] = segments;
  const meaningful = rest.filter((s) => s && !NUMERIC_ONLY_SEGMENT.test(s) && !NOISY_LABEL_SEGMENT.test(s));
  return { title: title ?? label, context: meaningful.slice(-2).join(", ") };
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

  const results = (() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return places
      .filter((p) => p.title.toLowerCase().includes(q) || p.address.toLowerCase().includes(q))
      .sort((a, b) => {
        const rankDiff = placeMatchRank(a, q) - placeMatchRank(b, q);
        if (rankDiff !== 0) return rankDiff;
        // При равной релевантности — ближе к текущему центру карты раньше.
        return (
          distanceScore({ lat: a.latitude, lng: a.longitude }, origin) -
          distanceScore({ lat: b.latitude, lng: b.longitude }, origin)
        );
      });
  })();

  useEffect(() => {
    const value = query.trim();
    if (value.length < MIN_ADDRESS_QUERY_LENGTH) {
      setAddressResults([]);
      return;
    }

    let active = true;
    const timer = window.setTimeout(() => {
      suggestAddresses(value, origin)
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
        <div
          className="flex gap-1 p-2 bg-white rounded-[length:var(--mappy-radius-2xl)] overflow-hidden"
          style={{
            // Токен «shadow m» из дизайн-системы (нода 2216:15782) — пять
            // слоёв drop-shadow нарастающего радиуса и убывающей плотности.
            // Последний слой (73px/88px, radius 32) отброшен: alpha там 0,
            // то есть он ничего не рисует — оставлен бы только для полной
            // формальной точности с токеном, без всякого визуального эффекта.
            boxShadow:
              "3px 4px 10px rgba(71,71,71,0.051), 12px 14px 18px rgba(71,71,71,0.039), 26px 32px 25px rgba(71,71,71,0.031), 47px 56px 29px rgba(71,71,71,0.012)",
          }}
        >
          <button
            onClick={onClose}
            className="w-[56px] h-12 rounded-l-[length:var(--mappy-radius-2xl)] rounded-r-[length:var(--mappy-radius-sm)] flex items-center justify-center shrink-0"
            style={{ backgroundColor: "rgba(3,7,18,0.04)" }}
            aria-label="Назад"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M9 14L4 9L9 4" stroke="var(--mappy-text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 9H14.5C17.5 9 20 11.5 20 14.5C20 17.5 17.5 20 14.5 20H8" stroke="var(--mappy-text-secondary)" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <div
            className="flex items-center gap-2 flex-1 h-12 pl-3 pr-3 rounded-l-[length:var(--mappy-radius-sm)] rounded-r-[length:var(--mappy-radius-2xl)] overflow-hidden"
            style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
          >
            <SearchIcon
              className="w-5 h-5 shrink-0"
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
              className="flex-1 min-w-0 bg-transparent outline-none text-[16px] font-medium placeholder:text-[color:var(--mappy-text-tertiary)]"
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
                  <path d="M12 4L4 12M4 4L12 12" stroke="var(--mappy-text-secondary)" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/*
        28px = 16px общего отступа экрана (тот же, что у капсулы поиска
        выше) + 12px собственного отступа блока результатов (нода 2214:11904,
        --spacing/space-sm) — это и есть тот самый «особый» отступ: не просто
        унаследованные от капсулы 16px, а на 12px больше.
      */}
      <div className="flex-1 overflow-y-auto px-7">
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
            <p className="text-[14px]" style={{ color: "var(--mappy-text-secondary)" }}>
              {place.address}
            </p>
          </button>
        ))}

        {addressResults.length > 0 && (
          <>
            {results.length > 0 && (
              <p
                className="pt-2 pb-1 text-[14px] font-medium"
                style={{ color: "var(--mappy-text-tertiary)" }}
              >
                Адреса
              </p>
            )}
            {addressResults.map((suggestion) => {
              const { title, context } = splitAddressLabel(suggestion.label);
              return (
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
                    {title}
                  </p>
                  {context && (
                    <p className="text-[14px]" style={{ color: "var(--mappy-text-secondary)" }}>
                      {context}
                    </p>
                  )}
                </button>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
