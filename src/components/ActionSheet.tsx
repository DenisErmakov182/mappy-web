/*
 * Системный action sheet по макету 1489:17684: группа действий на полупрозрачном
 * фоне + отдельная кнопка «Отменить».
 */
interface Action {
  label: string;
  color?: string;
  onClick: () => void;
}

export function ActionSheet({ actions, onCancel }: { actions: Action[]; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end bg-black/30 px-2 pb-[max(env(safe-area-inset-bottom),8px)]" onClick={onCancel}>
      <div
        className="rounded-[14px] overflow-hidden mb-2 backdrop-blur-xl"
        style={{ backgroundColor: "rgba(243,244,246,0.85)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {actions.map((action, i) => (
          <button
            key={action.label}
            onClick={action.onClick}
            className="w-full h-[57px] text-[19px]"
            style={{
              color: action.color ?? "#007aff",
              borderTop: i > 0 ? "0.5px solid rgba(60,60,67,0.29)" : "none",
            }}
          >
            {action.label}
          </button>
        ))}
      </div>
      <button
        onClick={onCancel}
        className="w-full h-[57px] rounded-[14px] bg-white text-[19px] font-semibold"
        style={{ color: "#007aff" }}
      >
        Отменить
      </button>
    </div>
  );
}
