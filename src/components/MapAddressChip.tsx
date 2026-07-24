import { SplitFlapAddress } from "./SplitFlapAddress";

/*
 * Плашка с адресом под поисковой строкой по макету 1893:39146 (вариант «сверху»,
 * а не пузырёк над самим пином — плотная карта легко перекрывает пузырёк
 * соседними подписями/пинами). Показывается, когда центральный пин остановился.
 * Блюр-ореол сзади — по макету 1893:39247, отступы заданы относительно пилюли
 * (не фиксированным размером кадра), чтобы подстраиваться под длину адреса.
 */
export function MapAddressChip({ address }: { address: string }) {
  return (
    <div className="relative">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute"
        style={{
          inset: "-18px -26px",
          borderRadius: 9999,
          backgroundColor: "rgba(209, 213, 220, 0.27)",
          backdropFilter: "blur(9px)",
          WebkitBackdropFilter: "blur(9px)",
          filter: "blur(5px)",
        }}
      />
      <div className="relative flex items-center justify-center rounded-[32px] bg-white px-4 py-3">
        <span
          className="whitespace-nowrap text-[16px] font-medium tracking-[-0.6px]"
          style={{ color: "var(--mappy-text-secondary)" }}
        >
          <SplitFlapAddress address={address} />
        </span>
      </div>
    </div>
  );
}
