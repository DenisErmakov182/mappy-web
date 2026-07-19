import { useEffect, useRef, useState } from "react";
import type { Place, PlaceCategory, VisitStatus } from "../types";
import { categoryLabel } from "../types";
import { reverseGeocode } from "../lib/geocode";
import { uploadPhoto } from "../lib/api";
import { CategoryIcon } from "./CategoryIcon";
import { CategoriesSheet } from "./CategoriesSheet";
import { Sheet, CtaButton, StarIcon } from "./primitives";
import stickerMuseum from "../assets/photos/sticker-museum.png";
import stickerCafe from "../assets/photos/sticker-cafe.png";
import stickerRestaurant from "../assets/photos/sticker-restaurant.png";

const MAX_PHOTOS = 10;

interface PhotoSlot {
  url: string; // blob-превью для новых или уже загруженный URL для существующих
  file?: File; // задано только для ещё не загруженных на S3 фото
}

function PlusIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5V19M5 12H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function RatingStarButton({
  star,
  filled,
  onSelect,
}: {
  star: number;
  filled: boolean;
  onSelect: () => void;
}) {
  const particleLayerRef = useRef<HTMLSpanElement>(null);

  const burst = () => {
    onSelect();
    const layer = particleLayerRef.current;
    if (!layer || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    layer.replaceChildren();
    const colors = ["#ffe166", "#ffd23f", "#ffc400", "#ffad00"];
    const count = 4 + Math.floor(Math.random() * 3);
    const angleOffset = Math.random() * Math.PI * 2;

    for (let index = 0; index < count; index += 1) {
      const spark = document.createElement("span");
      const angle = angleOffset + (Math.PI * 2 * index) / count + (Math.random() - 0.5) * 0.48;
      const distance = 46 + Math.random() * 21;
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const rotation = -145 + Math.random() * 290;
      const width = 7 + Math.random() * 3;
      const height = 17 + Math.random() * 8;

      Object.assign(spark.style, {
        position: "absolute",
        left: "50%",
        top: "50%",
        width: `${width}px`,
        height: `${height}px`,
        borderRadius: `${width / 2}px`,
        backgroundColor: colors[Math.floor(Math.random() * colors.length)],
        pointerEvents: "none",
        opacity: "0",
        willChange: "transform, opacity",
      });
      layer.appendChild(spark);

      const animation = spark.animate(
        [
          { opacity: 0, transform: `translate(-50%, -50%) rotate(${rotation * 0.12}deg) scale(0.2)`, offset: 0 },
          { opacity: 1, transform: `translate(-50%, -50%) translate(${x * 0.13}px, ${y * 0.13}px) rotate(${rotation * 0.12}deg) scale(0.8)`, offset: 0.22 },
          { opacity: 1, transform: `translate(-50%, -50%) translate(${x * 0.78}px, ${y * 0.78}px) rotate(${rotation * 0.78}deg) scale(1)`, offset: 0.72 },
          { opacity: 0, transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rotation}deg) scale(0.68)`, offset: 1 },
        ],
        { duration: 500, easing: "cubic-bezier(0.18, 0.74, 0.3, 1)", fill: "forwards" },
      );
      animation.finished.finally(() => spark.remove());
    }
  };

  return (
    <span className="relative isolate w-[52px] h-[52px] shrink-0">
      <span ref={particleLayerRef} className="absolute inset-0 z-0 pointer-events-none overflow-visible" aria-hidden="true" />
      <button
        type="button"
        onClick={burst}
        className="relative z-10 w-full h-full flex items-center justify-center"
        aria-label={`Оценка ${star}`}
      >
        <StarIcon filled={filled} />
      </button>
    </span>
  );
}

/*
 * Добавление места по макету 1489:16353 (+ флоу фото 1489:18077 → 1489:16383):
 * после выбора фото розовый блок сменяется сеткой 5x2 со слотами.
 */
export function AddPlaceSheet({
  coordinate,
  initialPlace,
  onSave,
  onClose,
}: {
  coordinate: { lat: number; lng: number };
  initialPlace?: Place;
  onSave: (place: Place) => Promise<void>;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(initialPlace?.title ?? "");
  const [address, setAddress] = useState(initialPlace?.address ?? "");
  const [status, setStatus] = useState<VisitStatus>(initialPlace?.status ?? "been");
  const [rating, setRating] = useState(initialPlace?.rating ?? 0);
  const [categories, setCategories] = useState<Set<PlaceCategory>>(new Set(initialPlace?.categories));
  const [note, setNote] = useState(initialPlace?.note ?? "");
  const [photos, setPhotos] = useState<PhotoSlot[]>(
    (initialPlace?.photoUrls ?? []).map((url) => ({ url })),
  );
  const [showCategories, setShowCategories] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Адрес подтягивается автоматически из координат точки (обратный геокодинг)
  // и не редактируется вручную. При редактировании берём сохранённый адрес.
  useEffect(() => {
    if (initialPlace) return;
    let cancelled = false;
    setAddressLoading(true);
    reverseGeocode(coordinate.lat, coordinate.lng)
      .then((addr) => {
        if (!cancelled) setAddress(addr);
      })
      .catch(() => {
        if (!cancelled) setAddress("");
      })
      .finally(() => {
        if (!cancelled) setAddressLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coordinate.lat, coordinate.lng, initialPlace]);

  const pickPhotos = () => fileInputRef.current?.click();

  const onFilesSelected = (files: FileList | null) => {
    if (!files) return;
    const next = [...photos];
    for (const file of Array.from(files)) {
      if (next.length >= MAX_PHOTOS) break;
      next.push({ url: URL.createObjectURL(file), file });
    }
    setPhotos(next);
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    setSaveError("");
    try {
      // Новые фото (с file) загружаем в S3, уже сохранённые URL оставляем как есть
      const photoUrls = await Promise.all(
        photos.map((p) => (p.file ? uploadPhoto(p.file) : Promise.resolve(p.url))),
      );
      await onSave({
        id: initialPlace?.id ?? "",
        title: title.trim(),
        address: address.trim(),
        latitude: initialPlace?.latitude ?? coordinate.lat,
        longitude: initialPlace?.longitude ?? coordinate.lng,
        rating,
        categories: [...categories],
        note: note.trim(),
        status,
        photoUrls,
      });
      onClose();
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Не удалось сохранить место");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    backgroundColor: "var(--mappy-surface-secondary)",
    color: "var(--mappy-text-primary)",
  } as const;

  return (
    <Sheet onClose={onClose}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => onFilesSelected(e.target.files)}
      />

      <div className="px-5 pb-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название"
            className="h-[46px] px-4 rounded-[14px] text-[16px] outline-none placeholder:text-[#99a1af]"
            style={inputStyle}
          />
          {/* Адрес только для чтения: определяется по координатам точки */}
          <div
            className="h-[46px] px-4 rounded-[14px] flex items-center text-[16px]"
            style={inputStyle}
          >
            {addressLoading ? (
              <span style={{ color: "#99a1af" }}>Определяем адрес…</span>
            ) : (
              <span style={{ color: address ? "var(--mappy-text-primary)" : "#99a1af" }}>
                {address || "Адрес не найден"}
              </span>
            )}
          </div>
        </div>

        {/* Сегмент-контрол 390x44, полное скругление — по макету */}
        <div
          className="flex h-[44px] items-center p-1 rounded-[28px]"
          style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
        >
          {(
            [
              ["been", "Уже был"],
              ["planning", "Планирую сходить"],
            ] as [VisitStatus, string][]
          ).map(([value, label]) => (
            <button
              key={value}
              onClick={() => setStatus(value)}
              className="flex flex-1 h-full items-center justify-center overflow-hidden px-6 rounded-[28px] text-[14px] leading-[18px] font-medium tracking-[-0.6px] transition-colors"
              style={{
                backgroundColor: status === value ? "#fff" : "transparent",
                color: status === value ? "var(--mappy-text-primary)" : "var(--mappy-text-secondary)",
              }}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex justify-center gap-3 py-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <RatingStarButton
              key={star}
              star={star}
              filled={star <= rating}
              onSelect={() => setRating(star)}
            />
          ))}
        </div>

        {photos.length === 0 ? (
          /* Пустое состояние: розовый блок с пунктиром и коллажем стикеров из макета */
          <div
            className="relative rounded-[20px] p-4"
            style={{
              background: "linear-gradient(180deg, #ffeef1 0%, #ffe3e9 100%)",
              border: "1.5px dashed #ffa1ad",
            }}
          >
            <div className="absolute -top-5 right-2 w-[118px] h-[122px] pointer-events-none select-none">
              <img
                src={stickerRestaurant}
                alt=""
                className="absolute right-0 top-0 w-[82px] h-[62px] object-cover rounded-md border-[3px] border-white shadow-md rotate-[8deg]"
              />
              <img
                src={stickerCafe}
                alt=""
                className="absolute right-[46px] top-[42px] w-[72px] h-[54px] object-cover rounded-md border-[3px] border-white shadow-md -rotate-[7deg]"
              />
              <img
                src={stickerMuseum}
                alt=""
                className="absolute right-[-2px] top-[58px] w-[74px] h-[56px] object-cover rounded-md border-[3px] border-white shadow-md rotate-[3deg]"
              />
            </div>

            <p className="text-[18px] font-semibold mb-0.5" style={{ color: "var(--mappy-text-primary)" }}>
              Добавьте фото <span className="font-normal" style={{ color: "var(--mappy-pink)" }}>до 10 шт</span>
            </p>
            <p className="text-[13px] leading-snug max-w-[220px] mb-4" style={{ color: "var(--mappy-text-secondary)" }}>
              Вашим друзьям будет легче понять, как выглядит место
            </p>
            <CtaButton onClick={pickPhotos}>
              <PlusIcon size={20} />
              <span>Добавить фото</span>
            </CtaButton>
          </div>
        ) : (
          /* Заполненное состояние: заголовок + сетка 5 колонок со слотами (макет 1489:16383) */
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[18px] font-semibold" style={{ color: "var(--mappy-text-primary)" }}>
                Добавьте фото <span className="font-normal" style={{ color: "#99a1af" }}>до 10 штук</span>
              </p>
              <button
                onClick={pickPhotos}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[18px]"
                style={{ backgroundColor: "var(--mappy-surface-secondary)", color: "var(--mappy-text-primary)" }}
                aria-label="Добавить ещё фото"
              >
                <PlusIcon />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: MAX_PHOTOS }).map((_, i) =>
                photos[i] ? (
                  <div key={i} className="relative aspect-square">
                    <img src={photos[i].url} alt="" className="w-full h-full object-cover rounded-[10px]" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white shadow flex items-center justify-center"
                      aria-label="Удалить фото"
                    >
                      <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                        <path d="M12 4L4 12M4 4L12 12" stroke="#4A5565" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    key={i}
                    onClick={pickPhotos}
                    className="aspect-square rounded-[10px] flex items-center justify-center text-[18px]"
                    style={{
                      border: "1.5px dashed #d1d5dc",
                      backgroundColor: "var(--mappy-surface-primary)",
                      color: "#99a1af",
                    }}
                    aria-label="Добавить фото"
                  >
                    <PlusIcon />
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <h3 className="text-[20px] font-semibold" style={{ color: "var(--mappy-text-primary)" }}>
            Добавьте категории
          </h3>
          <button
            onClick={() => setShowCategories(true)}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[20px] shrink-0"
            style={{ backgroundColor: "var(--mappy-surface-secondary)", color: "var(--mappy-text-primary)" }}
            aria-label="Добавить категории"
          >
            <PlusIcon size={20} />
          </button>
        </div>

        {categories.size > 0 && (
          <div className="flex flex-wrap gap-2 -mt-1">
            {[...categories].map((category) => (
              <span
                key={category}
                className="inline-flex items-center gap-1 pl-2 pr-3 py-2 rounded-[14px] text-[15px] font-medium"
                style={{ backgroundColor: "var(--mappy-surface-primary)", color: "var(--mappy-text-primary)" }}
              >
                <CategoryIcon category={category} size={20} />
                {categoryLabel[category]}
              </span>
            ))}
          </div>
        )}

        <div>
          <h3 className="text-[20px] font-semibold mb-3" style={{ color: "var(--mappy-text-primary)" }}>
            Поделитесь впечатлениями
          </h3>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Расскажите, как вам место?"
            rows={6}
            className="w-full p-4 rounded-[14px] text-[16px] outline-none resize-none placeholder:text-[#99a1af]"
            style={inputStyle}
          />
        </div>

        {saveError && (
          <p className="text-[13px] text-center" style={{ color: "#fb2c36" }}>
            {saveError}
          </p>
        )}
        <CtaButton onClick={handleSave} disabled={!title.trim() || saving}>
          {saving ? "Сохраняем…" : initialPlace ? "Сохранить" : "Добавить точку"}
        </CtaButton>
      </div>

      {showCategories && (
        <CategoriesSheet
          selected={categories}
          onApply={setCategories}
          onClose={() => setShowCategories(false)}
        />
      )}
    </Sheet>
  );
}
