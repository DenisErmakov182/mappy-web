import bigPin from "../assets/icons/big-pin.png";
import pinShadow from "../assets/icons/pin-shadow.svg";

/*
 * Главный пин в центре карты по макету 1489:15484 (71x88 + рассеянная тень).
 * При движении карты пин приподнимается, тень бледнеет и расширяется.
 * Тап по пину — добавить место в точке под остриём.
 */
export function CenterPin({ isMoving, onClick }: { isMoving: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label="Добавить место здесь"
      className="absolute left-1/2 top-1/2 z-10 pointer-events-auto"
      style={{ transform: "translate(-50%, -100%)", width: 95, height: 112 }}
    >
      <img
        src={pinShadow}
        alt=""
        className="absolute transition-all duration-200 ease-out"
        style={{
          left: 12,
          bottom: -14,
          width: 71,
          height: 59,
          opacity: isMoving ? 0.45 : 1,
          transform: isMoving ? "scale(1.25)" : "scale(1)",
        }}
      />
      <img
        src={bigPin}
        alt=""
        className="absolute transition-transform duration-200 ease-out"
        style={{
          left: 12,
          top: 16,
          width: 71,
          height: 88,
          objectFit: "contain",
          transform: isMoving ? "translateY(-14px)" : "translateY(0)",
        }}
      />
    </button>
  );
}
