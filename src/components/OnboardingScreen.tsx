import { useState, type ReactNode } from "react";
import { CtaButton } from "./primitives";
import { SearchFilterBar } from "./SearchFilterBar";
import bigPin from "../assets/icons/big-pin.png";

const ONBOARDING_KEY = "mappy_onboarding_seen";

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
    // localStorage недоступен — не блокируем вход онбордингом
    return true;
  }
}

function markOnboardingSeen() {
  try {
    localStorage.setItem(ONBOARDING_KEY, "1");
  } catch {
    // приватный режим и т.п. — не критично
  }
}

/* Мини-макет карты для превью первого шага: свои пины поверх декоративного фона */
function MapPreview() {
  return (
    <div
      className="relative w-full h-[220px] rounded-[20px] overflow-hidden"
      style={{ backgroundColor: "#e7efe3" }}
    >
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(0deg, transparent 47%, #fff 47%, #fff 53%, transparent 53%), linear-gradient(90deg, transparent 36%, #fff 36%, #fff 42%, transparent 42%)",
        }}
      />
      <MiniPin left="26%" top="66%" />
      <MiniPin left="72%" top="30%" />
      <MiniPin left="55%" top="52%" emphasized />
    </div>
  );
}

function MiniPin({ left, top, emphasized }: { left: string; top: string; emphasized?: boolean }) {
  return (
    <img
      src={bigPin}
      alt=""
      className="absolute"
      style={{
        left,
        top,
        width: emphasized ? 34 : 24,
        height: emphasized ? 42 : 30,
        objectFit: "contain",
        transform: "translate(-50%, -100%)",
        filter: emphasized ? undefined : "opacity(0.85)",
      }}
    />
  );
}

/* Превью второго шага: реальная строка поиска, неактивная (только для показа) */
function SearchPreview() {
  return (
    <div
      className="w-full h-[220px] rounded-[20px] overflow-hidden flex flex-col justify-center p-4"
      style={{ backgroundColor: "#e7efe3" }}
    >
      <div className="pointer-events-none">
        <SearchFilterBar
          query=""
          onOpenSearch={() => {}}
          onClearQuery={() => {}}
          hasActiveFilters
          onFilterTap={() => {}}
        />
      </div>
    </div>
  );
}

interface Step {
  title: string;
  description: string;
  buttonLabel: string;
  preview: ReactNode;
}

const steps: Step[] = [
  {
    title: "Твой пин находится там, где ты",
    description: "Мы определим твоё местоположение по геопозиции. Нажми на него, чтобы добавить место.",
    buttonLabel: "Это понятно!",
    preview: <MapPreview />,
  },
  {
    title: "Основная навигация: поиск и фильтры",
    description: "Ищи и сортируй места на карте удобными категориями!",
    buttonLabel: "Хорошо!",
    preview: <SearchPreview />,
  },
];

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const isLast = step === steps.length - 1;
  const current = steps[step];

  const finish = () => {
    markOnboardingSeen();
    onDone();
  };

  const next = () => {
    if (isLast) finish();
    else setStep((s) => s + 1);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col px-5 pt-[max(env(safe-area-inset-top),16px)] pb-[max(env(safe-area-inset-bottom),16px)]">
      <div className="flex gap-1.5 mb-6 shrink-0">
        {steps.map((_, i) => (
          <div
            key={i}
            className="flex-1 h-1 rounded-full overflow-hidden"
            style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
          >
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: i <= step ? "100%" : "0%",
                backgroundColor: "var(--mappy-pink)",
              }}
            />
          </div>
        ))}
      </div>

      <h1
        className="text-[22px] font-semibold leading-[26px] mb-4 shrink-0"
        style={{ color: "var(--mappy-text-primary)" }}
      >
        {current.title}
      </h1>

      {current.preview}

      <p
        className="text-[14px] leading-[19px] mt-4 shrink-0"
        style={{ color: "var(--mappy-text-secondary)" }}
      >
        {current.description}
      </p>

      <div className="flex-1" />

      <CtaButton onClick={next}>{current.buttonLabel}</CtaButton>
      <button
        onClick={finish}
        className="w-full h-12 mt-2 rounded-[14px] text-[15px] font-medium shrink-0"
        style={{ backgroundColor: "var(--mappy-surface-secondary)", color: "var(--mappy-text-primary)" }}
      >
        Пропустить
      </button>
    </div>
  );
}
