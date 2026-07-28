import mainPin from "../assets/icons/main-pin.webp";
import { CloseButton } from "./primitives";

/* Figma 2097:821. The parent decides when it is safe to show this notice. */
export function PwaUpdateBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="relative flex w-full items-start gap-[10px] overflow-hidden rounded-[28px] bg-[#101828] p-4"
      role="status"
    >
      <div className="flex items-center gap-[6px]">
        <img src={mainPin} alt="" className="h-[40.9px] w-[33px] shrink-0 object-contain -scale-x-100" />
        <div className="flex flex-col gap-1 whitespace-nowrap tracking-[-0.6px]">
          <p className="text-[20px] font-medium leading-6 text-white">Обновление готово</p>
          <p className="text-[16px] leading-5 text-[var(--mappy-text-tertiary)]">Закройте и откройте Mappy</p>
        </div>
      </div>
      <div className="absolute right-[11px] top-[11px]">
        <CloseButton
          onClick={onDismiss}
          size={26}
          backgroundColor="#101828"
          iconColor="var(--mappy-text-tertiary)"
          iconStrokeWidth={1.5}
        />
      </div>
    </div>
  );
}
