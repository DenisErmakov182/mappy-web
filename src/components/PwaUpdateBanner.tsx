/*
 * Figma ErrorCaption (2079:7926), reused as a global PWA update notice.
 * The parent decides when it is safe to show above the current screen.
 */
export function PwaUpdateBanner({ onUpdate }: { onUpdate: () => void }) {
  return (
    <div
      className="flex h-16 w-full items-center justify-between rounded-[32px] pl-4 pr-3 py-3"
      style={{ backgroundColor: "#ff637e" }}
      role="status"
    >
      <span className="shrink-0 whitespace-nowrap text-[16px] font-medium leading-[18px] tracking-[-0.6px] text-white">
        Вышло обновление
      </span>
      <button
        onClick={onUpdate}
        className="shrink-0 overflow-hidden rounded-[32px] px-4 py-2 text-[16px] font-medium leading-[18px] tracking-[-0.6px] text-white"
        style={{ backgroundColor: "rgba(3, 7, 18, 0.2)" }}
      >
        Обновить приложение
      </button>
    </div>
  );
}
