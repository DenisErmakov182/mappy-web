import { useEffect, useState } from "react";
import { CtaButton } from "./primitives";
import mapCrop from "../assets/onboarding/map-crop.png";
import onboardingPin from "../assets/onboarding/onboarding-pin.png";
import searchIcon from "../assets/icons/search-icon.svg";
import filterIcon from "../assets/icons/filter-icon.svg";
import tabMap from "../assets/icons/tab-map.png";
import tabNotes from "../assets/icons/tab-notes.png";
import tabFriends from "../assets/icons/tab-friends.png";
import starGold from "../assets/icons/star-gold.png";

const ONBOARDING_KEY = "mappy_onboarding_seen";

export function hasSeenOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === "1";
  } catch {
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

/*
 * Онбординг по макетам Figma (1613:38685 и далее): шаги 0-2 — один и тот же
 * "виртуальный" мокап телефона высотой 685px, окно 348px скроллится по нему
 * вертикально (статус-бар+поиск → карта → карточка места). Шаги 2-4 —
 * горизонтальный свайп между тремя разными страницами (карта → сохранённое →
 * друзья). Таббар — отдельный зафиксированный слой поверх обеих анимаций
 * (не едет ни вертикально, ни горизонтально), появляется с шага 2.
 */

const CARD_W = 316;
const CARD_H = 348;
const MOCK_H = 685;
// Сдвиг виртуального контента вверх/вниз для шагов 0,1,2 (точные значения из Figma)
const MAP_SCROLL_Y = [-156, 0, -337];

interface StepContent {
  headingLine1: string;
  headingLine2?: string;
  caption: string;
  buttonLabel: string;
}

const stepsContent: StepContent[] = [
  {
    headingLine1: "Твой пин находится там, где ты",
    caption: "Мы определим твоё местоположение по геопозиции. Нажми на него, чтобы добавить место",
    buttonLabel: "Это понятно!",
  },
  {
    headingLine1: "Основная навигация",
    headingLine2: "поиск и фильтры",
    caption: "Ищи и сортируй места на карте удобными категориями!",
    buttonLabel: "Хорошо!",
  },
  {
    headingLine1: "Основная навигация",
    headingLine2: "карта",
    caption:
      "Карта-твоя личная доска воспоминаний, возвращайся когда хочешь вспомнить где был или хотел сходить.\nНу и делись местами, само собой!",
    buttonLabel: "Отлично!",
  },
  {
    headingLine1: "Основная навигация",
    headingLine2: "сохранённое",
    caption: "Найдешь все нужные места в удобном списке!",
    buttonLabel: "Очень удобно, дальше!",
  },
  {
    headingLine1: "Основная навигация",
    headingLine2: "друзья",
    caption: "Добавляй друзей делись с ними местами или картой, теперь можно не писать часами всем вокруг, чтобы узнать куда идти!",
    buttonLabel: "К самому интересному",
  },
];

/* Мини-статус-бар мокапа (9:41 — декоративный) */
function MiniStatusBar() {
  return (
    <div className="absolute top-0 left-0 w-full h-[43px] flex items-end justify-center pb-1.5 z-10">
      <span className="text-[11px] font-semibold text-[#030712]">9:41</span>
    </div>
  );
}

/* Мини-строка поиска; при active=true символы "печатаются" сами, потом стираются */
function MiniSearchBar({ active }: { active: boolean }) {
  const [text, setText] = useState("");

  useEffect(() => {
    if (!active) {
      setText("");
      return;
    }
    const query = "Кофейня";
    let i = 0;
    const typeTimer = setInterval(() => {
      i += 1;
      setText(query.slice(0, i));
      if (i >= query.length) clearInterval(typeTimer);
    }, 130);
    const clearTimer = setTimeout(() => setText(""), 130 * query.length + 1400);
    return () => {
      clearInterval(typeTimer);
      clearTimeout(clearTimer);
    };
  }, [active]);

  return (
    <div className="absolute left-[11px] top-[48px] flex gap-1 bg-white p-1.5 rounded-[24px] z-10" style={{ width: 293 }}>
      <div className="flex-1 flex items-center gap-1 h-[35px] px-3 rounded-l-[24px] rounded-r-[7px]" style={{ backgroundColor: "var(--mappy-surface-secondary)" }}>
        <img src={searchIcon} alt="" className="w-[13px] h-[13px] shrink-0" />
        <span className="text-[9px] font-medium truncate" style={{ color: "var(--mappy-text-secondary)" }}>
          {text || "Поиск по адресу, названию"}
        </span>
      </div>
      <div className="h-[35px] w-[35px] rounded-r-[24px] rounded-l-[7px] flex items-center justify-center shrink-0" style={{ backgroundColor: "rgba(3,7,18,0.04)" }}>
        <img src={filterIcon} alt="" className="w-[13px] h-[13px]" />
      </div>
    </div>
  );
}

/*
 * Таббар — фиксированный слой поверх обеих анимаций (не часть скролла карты
 * и не часть горизонтального свайпа страниц), по образцу настоящего TabBar.tsx
 * (асимметричные скругления: крайние элементы больше со внешней стороны).
 */
function FixedTabBar({ active }: { active: "map" | "notes" | "friends" }) {
  const items: { id: "map" | "notes" | "friends"; icon: string; corners: string }[] = [
    { id: "map", icon: tabMap, corners: "rounded-l-[18px] rounded-r-[6px]" },
    { id: "notes", icon: tabNotes, corners: "rounded-[6px]" },
    { id: "friends", icon: tabFriends, corners: "rounded-r-[18px] rounded-l-[6px]" },
  ];
  return (
    <div className="absolute left-[11px] flex gap-1 bg-white p-1.5 rounded-[20px] z-20" style={{ bottom: 12, width: 293 }}>
      {items.map((item) => (
        <div
          key={item.id}
          className={`flex-1 h-[32px] flex items-center justify-center ${item.corners}`}
          style={{ backgroundColor: item.id === active ? "var(--mappy-brand-subtle)" : "var(--mappy-surface-secondary)" }}
        >
          <img
            src={item.icon}
            alt=""
            className="h-[16px] w-[22px] object-contain"
            style={item.id === active ? undefined : { filter: "grayscale(1) brightness(1.05)", opacity: 0.75 }}
          />
        </div>
      ))}
    </div>
  );
}

/* Map-страница: единый скроллящийся мокап (статус-бар/поиск/карта+пин) */
function MapPage({ step }: { step: number }) {
  const y = MAP_SCROLL_Y[Math.min(step, 2)];
  return (
    <div className="relative shrink-0 overflow-hidden" style={{ width: CARD_W, height: CARD_H, backgroundColor: "rgba(3,7,18,0.04)" }}>
      <div
        className="absolute left-0 top-0 transition-transform duration-500 ease-out"
        style={{ width: CARD_W, height: MOCK_H, transform: `translateY(${y}px)` }}
      >
        <MiniStatusBar />
        <MiniSearchBar active={step === 1} />
        <div className="absolute left-0 overflow-hidden" style={{ top: 104, width: CARD_W, height: 495 }}>
          <img src={mapCrop} alt="" className="w-full h-full object-cover" />
          <img
            src={onboardingPin}
            alt=""
            className={`absolute ${step === 0 ? "onboarding-pin-wiggle" : ""}`}
            style={{ left: "39%", top: "32%", width: 30, transform: "translate(-50%, -100%)" }}
          />
        </div>
      </div>
    </div>
  );
}

/* Notes-страница: карточка сохранённого места по образцу настоящего PlaceRowCard (фото слева) */
function NotesPage() {
  return (
    <div className="relative shrink-0 overflow-hidden" style={{ width: CARD_W, height: CARD_H, backgroundColor: "rgba(3,7,18,0.04)" }}>
      <MiniStatusBar />
      <div className="absolute left-[11px] right-[11px] top-[56px] flex flex-col gap-2">
        <div className="bg-white rounded-[16px] p-1.5 flex items-start gap-1.5" style={{ boxShadow: "0 6px 16px rgba(0,0,0,0.08)" }}>
          <div className="w-[64px] h-[46px] rounded-[10px] flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--mappy-surface-secondary)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="18" height="15" rx="2" stroke="#c4c9d1" strokeWidth="1.5" />
              <circle cx="9" cy="10" r="1.5" fill="#c4c9d1" />
              <path d="M4 17l5-5 4 4 3-3 4 4" stroke="#c4c9d1" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="flex flex-col gap-0.5 min-w-0 pt-0.5">
            <p className="text-[9px] font-semibold leading-[11px] truncate" style={{ color: "var(--mappy-text-primary)" }}>
              Ресторан космической кухни
            </p>
            <p className="text-[7px]" style={{ color: "var(--mappy-text-secondary)" }}>
              Сероводородная ул, 38
            </p>
            <div className="flex items-center gap-1 mt-0.5">
              <span className="inline-flex items-center gap-0.5 rounded-full px-1.5 h-[13px]" style={{ backgroundColor: "rgb(220, 252, 231)", color: "rgb(0, 166, 62)", fontSize: 7 }}>
                3<img src={starGold} alt="" className="w-[6px] h-[6px]" />
              </span>
              <span className="text-[7px]" style={{ color: "var(--mappy-text-secondary)" }}>
                Еда и напитки
              </span>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-[16px] p-1.5 flex items-start gap-1.5 opacity-50">
          <div className="w-[64px] h-[46px] rounded-[10px] shrink-0" style={{ backgroundColor: "var(--mappy-surface-secondary)" }} />
          <div className="flex-1" />
        </div>
      </div>
    </div>
  );
}

/* Friends-страница: список по образцу настоящего FriendsScreen (плоские строки с разделителем) */
function FriendsPage() {
  const rows = ["Денис Ермаков", "Денис Ермаков", "Денис Ермаков", "Денис Ермаков"];
  return (
    <div className="relative shrink-0 overflow-hidden bg-white" style={{ width: CARD_W, height: CARD_H }}>
      <MiniStatusBar />
      <div className="absolute left-[11px] right-[11px] top-[52px] flex flex-col">
        {rows.map((name, i) => (
          <div
            key={i}
            className="flex items-center gap-2 py-1.5"
            style={{ borderTop: i > 0 ? "1px solid var(--mappy-divider)" : "none" }}
          >
            <div className="w-[20px] h-[20px] rounded-full shrink-0" style={{ backgroundColor: "var(--mappy-brand-subtle)" }} />
            <div className="flex flex-col">
              <span className="text-[9px] font-semibold leading-[11px]" style={{ color: "var(--mappy-text-primary)" }}>
                {name}
              </span>
              <span className="text-[7px]" style={{ color: "var(--mappy-text-secondary)" }}>
                @denis
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OnboardingPreview({ step }: { step: number }) {
  const pageIndex = Math.max(0, Math.min(step - 2, 2));
  const activeTab = pageIndex === 0 ? "map" : pageIndex === 1 ? "notes" : "friends";
  return (
    <div
      className="relative rounded-[20px] overflow-hidden shrink-0"
      style={{ width: CARD_W, height: CARD_H, boxShadow: "0 24px 40px -12px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)" }}
    >
      <div
        className="flex h-full transition-transform duration-500 ease-out"
        style={{ width: CARD_W * 3, transform: `translateX(-${pageIndex * CARD_W}px)` }}
      >
        <MapPage step={step} />
        <NotesPage />
        <FriendsPage />
      </div>
      {step >= 2 && <FixedTabBar active={activeTab} />}
    </div>
  );
}

export function OnboardingScreen({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState(0);
  const isLast = step === stepsContent.length - 1;
  const current = stepsContent[step];
  const textAnimClass = step <= 2 ? "onboarding-text-up" : "onboarding-text-side";

  const finish = () => {
    markOnboardingSeen();
    onDone();
  };

  const next = () => {
    if (isLast) finish();
    else setStep((s) => s + 1);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col px-5 pt-[max(env(safe-area-inset-top),16px)] pb-[max(env(safe-area-inset-bottom),16px)] overflow-hidden">
      <div className="flex gap-1 mb-12 shrink-0">
        {stepsContent.map((_, i) => (
          <div key={i} className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--mappy-surface-secondary)" }}>
            {i <= step && (
              <div className="h-full rounded-full" style={{ background: "var(--mappy-gradient-cta)" }} />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-10 flex-1 overflow-hidden">
        <div key={`h-${step}`} className={`${textAnimClass} text-center w-full`}>
          <p className="text-[28px] font-semibold leading-[32px] tracking-[-0.6px] text-black">{current.headingLine1}</p>
          {current.headingLine2 && (
            <p className="text-[28px] font-semibold leading-[32px] tracking-[-0.6px] text-black">{current.headingLine2}</p>
          )}
        </div>

        <OnboardingPreview step={step} />

        <p
          key={`c-${step}`}
          className={`${textAnimClass} text-[16px] leading-[18px] text-center whitespace-pre-line`}
          style={{ color: "rgba(0,0,0,0.46)" }}
        >
          {current.caption}
        </p>
      </div>

      <div className="shrink-0 flex flex-col gap-3 pt-4">
        <CtaButton onClick={next}>{current.buttonLabel}</CtaButton>
        <button
          onClick={finish}
          className="w-full h-14 rounded-[14px] text-[16px] font-medium"
          style={{ backgroundColor: "rgba(3,7,18,0.04)", color: "var(--mappy-text-primary)" }}
        >
          Пропустить
        </button>
      </div>
    </div>
  );
}
