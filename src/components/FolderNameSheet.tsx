import { useState } from "react";
import { Sheet, CloseButton, CtaButton } from "./primitives";
import { FolderArt, folderArtPx as px, folderArtPy as py } from "./FolderArt";
import stickerCafe from "../assets/photos/sticker-cafe.webp";
import stickerMuseum from "../assets/photos/sticker-museum.webp";
import stickerRestaurant from "../assets/photos/sticker-restaurant.webp";

// Держим в паре с FOLDER_TITLE_MAX в mappy-api/src/lib/types.ts — фронт и
// бэк не делят код, лимит продублирован (как NOTE_MAX в AddPlaceSheet.tsx).
const FOLDER_TITLE_MAX = 50;

/*
 * Ввод названия папки по узлу 2289:41953 («Category Pop-Up» — узел
 * подтверждён владельцем 19.08.2026 явно, до этого код ошибочно опирался на
 * 2289:42934/2291:27724 с придуманным масштабом 1.583×). Открывается ПОВЕРХ
 * AddPlaceSheet — прецедент есть, см. CategoriesSheet/ReorderPhotosSheet/
 * PhotoCaptionSheet, все три уже так живут.
 *
 * Иллюстрация — тот же FolderArt, что и у FolderCard, В ТУ ЖЕ натуральную
 * величину 195×139 (узел 2289:41953 показывает ровно её — три CategoryCards
 * + Highlight, как в FolderCard, без отдельного масштаба). Три фото на
 * иллюстрации — не выбор пользователя и не реальные фото мест (у папки на
 * этом шаге их ещё физически быть не может, она только создаётся): те же
 * три стикера-заглушки, что уже есть в проекте для формы места.
 *
 * Текст названия — живой <input> поверх кармана вместо статичного <p> из
 * FolderCard, в той же точке (px(9), py(80)), тем же шрифтом — в макете
 * название печатается прямо на самой папке.
 */
const NAME_PHOTOS = [stickerCafe, stickerMuseum, stickerRestaurant];

function FolderNameArt({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="mx-auto" style={{ width: 195 }}>
      <FolderArt coverPhotos={NAME_PHOTOS}>
        {/* Настоящий инпут вместо статичного текста — название печатается
            прямо на папке. Та же точка и шрифт, что title у FolderCard. */}
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.slice(0, FOLDER_TITLE_MAX))}
          placeholder={placeholder}
          autoFocus
          className="absolute bg-transparent font-semibold text-white outline-none placeholder:text-white/70"
          style={{
            left: px(9),
            top: py(80),
            right: px(9),
            fontSize: "16px",
            lineHeight: "18px",
            letterSpacing: "-0.6px",
          }}
        />
      </FolderArt>
    </div>
  );
}

export function FolderNameSheet({
  title,
  subtitle,
  confirmLabel,
  onConfirm,
  onClose,
}: {
  /** «Как назовем папку?» или «Ваша первая папка» — контекст открытия разный. */
  title: string;
  subtitle?: string;
  /** «Назвать» / «Создать» — тоже зависит от контекста. */
  confirmLabel: string;
  onConfirm: (title: string) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();

  return (
    <Sheet onClose={onClose}>
      <div className="flex flex-col gap-4 px-5 pb-4">
        <div className="flex items-start justify-between gap-3 pl-1">
          <div className="flex flex-col gap-1">
            <h3
              className="text-[28px] leading-8 font-semibold tracking-[-0.6px]"
              style={{ color: "var(--mappy-text-secondary)" }}
            >
              {title}
            </h3>
            {subtitle && (
              <p className="text-[14px] leading-[18px]" style={{ color: "var(--mappy-text-secondary)" }}>
                {subtitle}
              </p>
            )}
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <FolderNameArt value={value} onChange={setValue} placeholder="Название папки" />

        <CtaButton onClick={() => trimmed && onConfirm(trimmed)} disabled={!trimmed}>
          {confirmLabel}
        </CtaButton>
      </div>
    </Sheet>
  );
}
