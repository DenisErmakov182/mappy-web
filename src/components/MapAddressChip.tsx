import { SplitFlapAddress } from "./SplitFlapAddress";

/*
 * Плашка с адресом под поисковой строкой по макету 1893:39146 (вариант «сверху»,
 * а не пузырёк над самим пином — плотная карта легко перекрывает пузырёк
 * соседними подписями/пинами). Показывается, когда центральный пин остановился.
 */
export function MapAddressChip({ address }: { address: string }) {
  return (
    <div className="relative">
      <div className="relative flex max-w-[340px] items-center justify-center rounded-[length:var(--mappy-radius-2xl)] bg-white px-4 py-3">
        <span
          className="text-center text-[16px] font-medium tracking-[-0.6px]"
          style={{ color: "var(--mappy-text-secondary)" }}
        >
          <SplitFlapAddress address={address} />
        </span>
      </div>
    </div>
  );
}
