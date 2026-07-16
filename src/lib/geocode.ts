/*
 * Обратный геокодинг координат → человекочитаемый адрес.
 * Пока через публичный Nominatim (OSM). Для продакшена в РФ лучше заменить на
 * DaData / Yandex Geosuggest (лучшее покрытие адресов) и self-hosted инстанс.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=ru&zoom=18`;
  const res = await fetch(url, { headers: { "Accept-Language": "ru" } });
  if (!res.ok) throw new Error(`Nominatim ${res.status}`);
  const data = await res.json();
  const a = data.address ?? {};
  // Собираем короткий адрес «улица, дом» из наиболее релевантных полей
  const street = a.road ?? a.pedestrian ?? a.footway ?? a.neighbourhood ?? a.suburb;
  const house = a.house_number;
  if (street && house) return `${street}, ${house}`;
  if (street) return street;
  return data.display_name?.split(",").slice(0, 2).join(",").trim() ?? "";
}
