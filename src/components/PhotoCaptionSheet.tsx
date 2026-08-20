import { useState } from "react";
import { Sheet, CloseButton, CtaButton } from "./primitives";

const CAPTION_MAX = 50;

/* Подпись к фото — отдельный bottom sheet по макету 1927:35302. */
export function PhotoCaptionSheet({
  initialCaption,
  onSave,
  onClose,
}: {
  initialCaption?: string;
  onSave: (caption: string) => void;
  onClose: () => void;
}) {
  const [caption, setCaption] = useState(initialCaption ?? "");

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-4 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h3
            className="text-[20px] leading-6 font-medium tracking-[-0.6px]"
            style={{ color: "var(--mappy-text-primary)" }}
          >
            Подпись
          </h3>
          <CloseButton onClick={onClose} />
        </div>

        <div
          className="flex flex-col gap-2 rounded-[length:var(--mappy-radius-md)] p-4"
          style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
        >
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, CAPTION_MAX))}
            placeholder="Ваши мысли о месте"
            rows={3}
            maxLength={CAPTION_MAX}
            autoFocus
            className="w-full bg-transparent text-[16px] outline-none resize-none placeholder:text-[color:var(--mappy-text-tertiary)]"
            style={{ color: "var(--mappy-text-primary)" }}
          />
          <span
            className="self-end text-[12px] leading-4 font-medium"
            style={{ color: "var(--mappy-text-tertiary)" }}
          >
            {caption.length}/{CAPTION_MAX}
          </span>
        </div>

        <CtaButton onClick={() => onSave(caption.trim())}>Сохранить</CtaButton>
      </div>
    </Sheet>
  );
}
