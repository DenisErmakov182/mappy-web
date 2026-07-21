import { useEffect, useRef, useState } from "react";
import type { Place, PlaceCategory, VisitStatus } from "../types";
import { categoryLabel } from "../types";
import { reverseGeocode, uploadPhoto } from "../lib/api";
import { blockPwaUpdateReload } from "../lib/pwaUpdate";
import { CategoryIcon } from "./CategoryIcon";
import { CategoriesSheet } from "./CategoriesSheet";
import { Sheet, CtaButton, StarIcon } from "./primitives";
import { SplitFlapAddress } from "./SplitFlapAddress";
import stickerMuseum from "../assets/photos/sticker-museum.webp";
import stickerCafe from "../assets/photos/sticker-cafe.webp";

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

function PrivacyToggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label="Личная заметка"
      onClick={() => onChange(!checked)}
      className="relative h-[28px] w-[53px] shrink-0 overflow-hidden rounded-[32px] transition-colors duration-200"
      style={{ backgroundColor: checked ? "#ff637e" : "#f3f4f6" }}
    >
      <span
        className="absolute top-[3px] h-[22px] w-[22px] rounded-[32px] transition-[left,background-color] duration-200"
        style={{
          left: checked ? 28 : 3,
          backgroundColor: checked ? "var(--mappy-surface-primary)" : "#99a1af",
        }}
      />
    </button>
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
    <span className="relative isolate size-[60px] shrink-0">
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
  const [isPrivate, setIsPrivate] = useState(initialPlace?.isPrivate ?? false);
  const [photos, setPhotos] = useState<PhotoSlot[]>(
    (initialPlace?.photoUrls ?? []).map((url) => ({ url })),
  );
  const [showCategories, setShowCategories] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [addressError, setAddressError] = useState("");
  const [showAddressAnimation, setShowAddressAnimation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // An update may finish while a user is creating or editing a place. Keep
    // the current runtime until the sheet is saved or closed, then apply the
    // already downloaded build with a single reload.
    return blockPwaUpdateReload();
  }, []);

  // Адрес подтягивается автоматически из координат точки (обратный геокодинг)
  // и не редактируется вручную. При редактировании берём сохранённый адрес.
  useEffect(() => {
    if (initialPlace) return;
    let cancelled = false;
    setShowAddressAnimation(false);
    setAddressLoading(true);
    setAddressError("");
    reverseGeocode(coordinate.lat, coordinate.lng)
      .then((addr) => {
        if (!cancelled) {
          setAddress(addr);
          setShowAddressAnimation(Boolean(addr));
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setAddress("");
          setAddressError(error instanceof Error ? error.message : "Не удалось определить адрес");
        }
      })
      .finally(() => {
        if (!cancelled) setAddressLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [coordinate.lat, coordinate.lng, initialPlace]);

  useEffect(() => {
    if (!showAddressAnimation) return;
    const duration = Array.from(address).length * 34 + 430;
    const timeout = window.setTimeout(() => setShowAddressAnimation(false), duration);
    return () => window.clearTimeout(timeout);
  }, [address, showAddressAnimation]);

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
        isPrivate,
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

      <div className="px-5 pb-4 flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название"
            className="h-[46px] px-4 rounded-[14px] text-[16px] outline-none placeholder:text-[#99a1af]"
            style={inputStyle}
          />
          <div className="relative">
            <input
              value={address}
              onFocus={() => setShowAddressAnimation(false)}
              onChange={(event) => {
                setShowAddressAnimation(false);
                setAddress(event.target.value);
                if (addressError) setAddressError("");
              }}
              placeholder={addressLoading ? "Определяем адрес…" : addressError ? "Введите адрес вручную" : "Адрес"}
              disabled={addressLoading}
              aria-label="Адрес"
              className="h-[46px] w-full px-4 rounded-[14px] text-[16px] outline-none placeholder:text-[#99a1af] disabled:opacity-100"
              style={{
                ...inputStyle,
                color: showAddressAnimation ? "transparent" : inputStyle.color,
                caretColor: showAddressAnimation ? "transparent" : "auto",
              }}
            />
            {showAddressAnimation && (
              <span
                className="pointer-events-none absolute inset-0 flex items-center overflow-hidden rounded-[14px] px-4 text-[16px]"
                style={{ color: "var(--mappy-text-primary)" }}
                aria-hidden="true"
              >
                <SplitFlapAddress address={address} />
              </span>
            )}
          </div>
          {addressError && (
            <p className="px-1 text-[12px] leading-[16px]" style={{ color: "var(--mappy-text-secondary)" }}>
              Не удалось определить автоматически — адрес можно ввести вручную
            </p>
          )}
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

        <div className="flex h-[68px] w-full items-center justify-center gap-2 overflow-hidden rounded-[16px] py-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <RatingStarButton
              key={star}
              star={star}
              filled={star <= rating}
              onSelect={() => setRating(star)}
            />
          ))}
        </div>

        <div className="flex items-start justify-between">
          <div className="flex px-1">
            <div className="flex flex-col gap-1">
              <p
                className="text-[20px] leading-6 font-medium tracking-[-0.6px]"
                style={{ color: "var(--mappy-text-primary)" }}
              >
                Личная заметка
              </p>
              <p
                className="text-[12px] leading-4 tracking-[-0.6px]"
                style={{ color: "#99a1af" }}
              >
                Только вы увидите это место
              </p>
            </div>
          </div>
          <PrivacyToggle checked={isPrivate} onChange={setIsPrivate} />
        </div>

        {photos.length === 0 ? (
          /* Пустое состояние: полноценный CTA загрузки из макета 860:20927. */
          <div
            className="relative -mx-1 flex h-[174px] w-[calc(100%+8px)] flex-col gap-4 overflow-hidden rounded-[24px] border border-dashed p-4"
            style={{
              backgroundColor: "rgba(255, 32, 86, 0.11)",
              borderColor: "rgba(255, 32, 86, 0.7)",
            }}
          >
            <div
              className="pointer-events-none absolute left-[284px] top-[-11px] flex h-[69.081px] w-[90.646px] items-center justify-center select-none"
              aria-hidden="true"
            >
              <div className="rotate-[11.05deg]">
                <img
                  src={stickerCafe}
                  alt=""
                  className="h-[54.427px] w-[81.731px] rounded-[13.331px] border-[1.666px] border-[#f5f5f5] object-cover shadow-[0_12px_20.2px_rgba(145,12,12,0.25)]"
                />
              </div>
            </div>
            <div
              className="pointer-events-none absolute left-[319px] top-[15px] flex h-[69.525px] w-[94.315px] items-center justify-center select-none"
              aria-hidden="true"
            >
              <div className="-rotate-[7.9deg]">
                <img
                  src={stickerMuseum}
                  alt=""
                  className="h-[58.099px] w-[87.158px] rounded-[13.031px] border-[1.629px] border-[#f5f5f5] object-cover shadow-[0_12px_20.2px_rgba(145,12,12,0.25)]"
                />
              </div>
            </div>

            <div className="relative z-10 flex w-[268px] flex-col gap-1.5 px-1">
              <div className="flex items-start gap-2 whitespace-nowrap text-[20px] leading-6">
                <p className="font-medium tracking-[-0.6px]" style={{ color: "var(--mappy-text-primary)" }}>
                  Добавьте фото
                </p>
                <p className="font-normal" style={{ color: "var(--mappy-text-secondary)" }}>
                  до 10 шт
                </p>
              </div>
              <p
                className="w-[260px] text-[14px] leading-5 tracking-[-0.32px]"
                style={{ color: "var(--mappy-text-secondary)" }}
              >
                Вам и вашим друзьям будет легче вспомнить, что понравилось, а что нет
              </p>
            </div>
            <button
              type="button"
              onClick={pickPhotos}
              className="relative z-10 flex h-14 w-full shrink-0 items-center justify-center gap-1 rounded-[14px] text-[16px] leading-[18px] font-medium tracking-[-0.6px] text-white"
              style={{ backgroundColor: "#ff637e" }}
            >
              <PlusIcon size={20} />
              <span>Добавить фото</span>
            </button>
          </div>
        ) : (
          /* Заполненное состояние: заголовок + сетка 5 колонок со слотами (макет 1489:16383) */
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <p
                className="px-1 text-[20px] leading-6 font-medium tracking-[-0.6px]"
                style={{ color: "var(--mappy-text-primary)" }}
              >
                Добавьте фото <span className="font-normal" style={{ color: "#99a1af" }}>до 10 штук</span>
              </p>
              <button
                type="button"
                onClick={pickPhotos}
                className="flex size-7 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: "var(--mappy-surface-secondary)", color: "var(--mappy-text-primary)" }}
                aria-label="Добавить ещё фото"
              >
                <PlusIcon size={20} />
              </button>
            </div>
            <div className="grid grid-cols-5 gap-3">
              {Array.from({ length: MAX_PHOTOS }).map((_, i) =>
                photos[i] ? (
                  <div key={i} className="relative aspect-square">
                    <img src={photos[i].url} alt="" className="w-full h-full object-cover rounded-[10px]" />
                    <button
                      onClick={() => removePhoto(i)}
                      className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full"
                      style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
                      aria-label="Удалить фото"
                    >
                      <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                        <path d="M12 4L4 12M4 4L12 12" stroke="#1E2939" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    key={i}
                    type="button"
                    onClick={pickPhotos}
                    className="flex aspect-square items-center justify-center rounded-[14px]"
                    style={{
                      border: "1px dashed rgba(3, 7, 18, 0.08)",
                      backgroundColor: "var(--mappy-surface-primary)",
                      color: "var(--mappy-text-primary)",
                    }}
                    aria-label="Добавить фото"
                  >
                    <span
                      className="flex size-[26px] items-center justify-center rounded-full"
                      style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
                    >
                      <PlusIcon size={16} />
                    </span>
                  </button>
                ),
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3
              className="px-1 text-[20px] leading-6 font-medium tracking-[-0.6px]"
              style={{ color: "var(--mappy-text-primary)" }}
            >
              Добавьте категории
            </h3>
            <button
              type="button"
              onClick={() => setShowCategories(true)}
              className="flex size-7 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: "var(--mappy-surface-secondary)", color: "var(--mappy-text-primary)" }}
              aria-label="Добавить категории"
            >
              <PlusIcon size={20} />
            </button>
          </div>

          {categories.size > 0 && (
            <div className="flex flex-wrap gap-x-2 gap-y-3">
              {[...categories].map((category) => (
                <span
                  key={category}
                  className="inline-flex items-center gap-1 rounded-[14px] py-3 pl-2 pr-3 text-[16px] leading-[18px] font-medium tracking-[-0.6px]"
                  style={{ backgroundColor: "var(--mappy-surface-primary)", color: "var(--mappy-text-primary)" }}
                >
                  <CategoryIcon category={category} size={20} />
                  {categoryLabel[category]}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h3
            className="px-1 text-[20px] leading-6 font-medium tracking-[-0.6px]"
            style={{ color: "var(--mappy-text-primary)" }}
          >
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
