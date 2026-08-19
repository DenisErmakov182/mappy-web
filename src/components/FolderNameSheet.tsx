import { useState } from "react";
import { Sheet, CloseButton, CtaButton } from "./primitives";
import folderBack from "../assets/illustrations/folder-back.svg";
import folderShadow from "../assets/illustrations/folder-shadow.svg";
import stickerCafe from "../assets/photos/sticker-cafe.webp";
import stickerMuseum from "../assets/photos/sticker-museum.webp";
import stickerRestaurant from "../assets/photos/sticker-restaurant.webp";

// Держим в паре с FOLDER_TITLE_MAX в mappy-api/src/lib/types.ts — фронт и
// бэк не делят код, лимит продублирован (как NOTE_MAX в AddPlaceSheet.tsx).
const FOLDER_TITLE_MAX = 50;

/*
 * Ввод названия папки по узлу 2289:42934 (стандартный «Как назовём папку?»)
 * и 2291:27724 («Ваша первая папка» — тот же шит, другие заголовок/подпись/
 * текст кнопки для контекста «это первая папка, создаём по пути из формы
 * места»). Открывается ПОВЕРХ AddPlaceSheet — прецедент есть, см.
 * CategoriesSheet/ReorderPhotosSheet/PhotoCaptionSheet, все три уже так живут.
 *
 * Иллюстрация — не картинка, а тот же тип графики, что и FolderCard (SVG
 * подложка + три декоративные фото-карточки), только крупнее и с настоящим
 * <input> поверх текста вместо статичного <p> — в макете название печатается
 * прямо на самой папке. Три фото на иллюстрации — не выбор пользователя и не
 * реальные фото мест (у папки на этом шаге их ещё физически быть не может,
 * она только создаётся): те же три стикера-заглушки, что уже есть в проекте
 * для формы места (sample-photos), просто как декорация.
 *
 * Геометрия — фиксированные пиксели, не проценты, как у FolderCard: там
 * карточка тянется по ширине колонки сетки, здесь она — контентный блок
 * внутри Sheet с обычным горизонтальным паддингом, ширина которого не гуляет
 * так же сильно. Числа — из макета 308.622×219.992 (масштаб 1.583× от базовой
 * геометрии карточки 195×139), округлены до целого пикселя.
 */
const PHOTO_SLOTS = [
  { left: 22, top: 75, w: 112, h: 95, rotate: -7.09, src: stickerCafe },
  { left: 122, top: 66, w: 112, h: 95, rotate: 10.69, src: stickerMuseum },
  { left: 156, top: 87, w: 113, h: 95, rotate: 0.34, src: stickerRestaurant },
] as const;

function FolderNameArt({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative mx-auto" style={{ width: 309, height: 220 }}>
      <img
        src={folderBack}
        alt=""
        className="pointer-events-none absolute select-none"
        style={{ left: -16, top: 50, width: 341, maxWidth: "none" }}
      />

      {PHOTO_SLOTS.map((slot, index) => (
        <span
          key={index}
          className="pointer-events-none absolute block overflow-hidden border-white bg-white"
          style={{
            left: slot.left,
            top: slot.top,
            width: slot.w,
            height: slot.h,
            transform: `rotate(${slot.rotate}deg)`,
            borderWidth: 4.5,
            borderRadius: 16,
          }}
        >
          <img src={slot.src} alt="" className="h-full w-full select-none object-cover" />
        </span>
      ))}

      <span
        className="pointer-events-none absolute block"
        style={{
          left: 0,
          top: 119,
          width: "100%",
          height: 101,
          backgroundColor: "#ff2056",
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
          boxShadow: "inset 0 -8px 27px -2px #c10007",
        }}
      />
      <span
        className="pointer-events-none absolute block border-dashed"
        style={{
          left: 3,
          top: 122,
          width: 303,
          height: 95,
          borderColor: "#c10007",
          borderBottomWidth: 1.5,
          borderLeftWidth: 1.5,
          borderRightWidth: 1.5,
          borderTopWidth: 0,
          borderBottomLeftRadius: 30,
          borderBottomRightRadius: 30,
        }}
      />

      {/* Настоящий инпут вместо статичного текста из макета — название
          печатается прямо на папке. Позиция/шрифт скопированы с <p> в
          исходном узле (left 14.24 / top 126.61 / 25.32px semibold). */}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, FOLDER_TITLE_MAX))}
        placeholder={placeholder}
        autoFocus
        className="absolute bg-transparent font-semibold text-white outline-none placeholder:text-white/70"
        style={{
          left: 14,
          top: 124,
          width: 280,
          fontSize: 25,
          lineHeight: "28px",
          letterSpacing: "-0.6px",
        }}
      />

      {/* Декоративная полоска у низа кармана (тот же Rectangle 5177, что
          встроен в folder-pocket.svg у FolderCard, здесь — отдельным
          файлом folder-shadow.svg). top не 208 (нижний край композиции),
          а выше: у самой картинки ~37% высоты — прозрачный запас под блюр
          сверху и снизу видимой линии (viewBox 187.915×15.9147, видимая
          часть — y 5.96–9.96). При top:208 видимая линия попадала точно
          на границу кармана и половина блюра утекала наружу, под низом
          папки — баг, найденный владельцем визуально. 199.5 = 208.913
          (Rectangle 5177 в макете 2289:42956) минус доля запаса сверху. */}
      <img
        src={folderShadow}
        alt=""
        className="pointer-events-none absolute select-none"
        style={{ left: 9, top: 199.5, width: 296, maxWidth: "none" }}
      />
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
