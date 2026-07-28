import mainPin from "../assets/icons/main-pin.webp";
import { CloseButton } from "./primitives";

/* Figma 2097:821. The parent decides when it is safe to show this notice. */
export function PwaUpdateBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div
      className="flex min-h-[82px] w-full items-center justify-between gap-[10px] overflow-hidden rounded-[28px] bg-[#101828] py-4 pl-[60px] pr-4"
      role="status"
    >
      <div className="flex min-w-0 items-center gap-[6px]">
        <img src={mainPin} alt="" className="h-[50px] w-[41px] shrink-0 object-contain" />
        <div className="min-w-0 whitespace-nowrap tracking-[-0.6px]">
          <p className="text-[20px] font-medium leading-6 text-white">Обновление готово</p>
          <p className="text-[16px] leading-5 text-[var(--mappy-text-tertiary)]">Закройте и откройте Mappy</p>
        </div>
      </div>
      <CloseButton onClick={onDismiss} size={26} />
    </div>
  );
}
