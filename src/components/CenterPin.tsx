import bigPin from "../assets/icons/big-pin.webp";
import raisedPinShadow from "../assets/icons/center-pin-shadow-raised.webp";
import restingPinShadow from "../assets/icons/center-pin-shadow-rest.webp";

/*
 * Главный пин в центре карты по макету 1489:15484 (71x88 + рассеянная тень).
 * При движении карты пин приподнимается, а точные тени из Figma сменяются
 * кроссфейдом без браузерного масштабирования blur-фильтра.
 * Тап по пину — добавить место в точке под остриём.
 */
export function CenterPin({ isMoving, onClick }: { isMoving: boolean; onClick: () => void }) {
  return (
    <button
      onClick={() => {
        if (!isMoving) onClick();
      }}
      disabled={isMoving}
      aria-label="Добавить место здесь"
      className="absolute left-1/2 top-1/2 z-10 pointer-events-auto"
      // Остриё большого пина (y = 16 + 88) совпадает с географическим
      // центром карты. Поэтому сохранённый маркер появляется ровно в этой точке.
      style={{ transform: "translate(-50%, -104px)", width: 95, height: 112 }}
    >
      <img
        src={restingPinShadow}
        alt=""
        className="absolute transition-opacity duration-200 ease-out"
        style={{
          left: 15,
          top: 57,
          width: 73,
          height: 68.33,
          opacity: isMoving ? 0 : 1,
        }}
      />
      <img
        src={raisedPinShadow}
        alt=""
        className="absolute transition-opacity duration-200 ease-out"
        style={{
          left: 0,
          top: 53,
          width: 95.67,
          height: 84.67,
          opacity: isMoving ? 1 : 0,
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
