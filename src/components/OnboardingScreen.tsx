import { useEffect, useState } from "react";
import { CtaButton } from "./primitives";
import mapCrop from "../assets/onboarding/map-crop.png";
import notesPreview from "../assets/onboarding/notes-preview.png";
import friendsPreview from "../assets/onboarding/friends-preview.png";
import searchBlur from "../assets/onboarding/search-blur.png";
import mainPin from "../assets/icons/main-pin.png";
import searchIcon from "../assets/icons/search-icon.svg";
import filterIcon from "../assets/icons/filter-icon.svg";
import tabMap from "../assets/icons/tab-map.png";
import tabNotes from "../assets/icons/tab-notes.png";
import tabFriends from "../assets/icons/tab-friends.png";

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
// Блюр-накладки растянуты не по своим пропорциям, а под края конкретных
// элементов, которые они «поддерживают»:
// под поиском (search-blur.png) — нижним краем по низу поисковой строки
// (top:32 + h:35 + padding 6+6)
const EDGE_BLUR_TOP_H = 79;
// в заметках та же подложка чуть выше (поднята дополнительно на глаз)
const NOTES_EDGE_BLUR_TOP_H = EDGE_BLUR_TOP_H + 12;
// под таббаром — верхним краем на 8px выше верха таббара (bottom:12 + h:32 + padding 6+6 + 8)
const EDGE_BLUR_BOTTOM_H = 64;
// Сам файл search-blur.png заранее обрезан (см. скрипт в истории) до чистого
// вертикального градиента без прозрачных полей по бокам — поэтому рендерим
// его ровно в ширину карточки, без доп. запаса на обрезку оверфлоу
const EDGE_BLUR_W = CARD_W;
// Сдвиг виртуального контента вверх/вниз для шагов 0,1,2 (точные значения из Figma)
const MAP_SCROLL_Y = [-156, 0, -337];
// Notes/Friends используют тот же приём «виртуального мокапа» высотой MOCK_H:
// Notes открывается снизу и сама прокручивается наверх, Friends продолжает вниз
const NOTES_SCROLL_Y: [number, number] = [-337, 0];
const FRIENDS_SCROLL_Y: [number, number] = [0, -337];
const AUTO_SCROLL_DELAY = 1000;

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
    buttonLabel: "Начать пользоваться!",
  },
];

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
    <div className="absolute left-[11px] top-[32px] flex gap-1 bg-white p-1.5 rounded-[24px] z-10" style={{ width: 293 }}>
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

/*
 * Map-страница: единый скроллящийся мокап (статус-бар/поиск/карта+пин).
 * Карта — реальный скриншот, используется просто как анимированный фон
 * (не привязан к конкретным координатам) и растянут на всю высоту мокапа
 * (685px), чтобы не было пустых серых зон сверху/снизу при скролле.
 */
function MapPage({ step }: { step: number }) {
  const y = MAP_SCROLL_Y[Math.min(step, 2)];
  return (
    <div className="relative shrink-0 overflow-hidden" style={{ width: CARD_W, height: CARD_H }}>
      <div
        className="absolute left-0 top-0 transition-transform duration-500 ease-out"
        style={{ width: CARD_W, height: MOCK_H, transform: `translateY(${y}px)` }}
      >
        <img src={mapCrop} alt="" className="absolute left-0 top-0 w-full h-full object-cover" />
        {/* Блюр-подложка под поисковой строкой — часть скроллящегося мокапа, поэтому
            выезжает и уезжает вместе со строкой поиска, а не висит отдельным слоем */}
        <img
          src={searchBlur}
          alt=""
          className="absolute top-0 pointer-events-none"
          style={{ left: "50%", width: EDGE_BLUR_W, height: EDGE_BLUR_TOP_H, transform: "translateX(-50%) rotate(180deg)" }}
        />
        {/* Пин как в проде (main-pin.png), по центру блока: покачивается вокруг своего
            металлического носика (transform-origin снизу по центру img), носик стоит
            на месте, под ним статичная рассеянная тень — не крутится вместе с пином.
            Показываем только на шагах 0-1: центрирование посчитано под окно шага 0,
            на шаге 2 (окно съезжает к низу мокапа) пин иначе вылезал бы обрезком сверху. */}
        {step < 2 && (
          <div className="absolute" style={{ left: "50%", top: 330, transform: "translate(-50%, -50%)" }}>
            <div
              className="absolute rounded-full"
              style={{
                left: "50%",
                bottom: 2,
                width: 26,
                height: 9,
                transform: "translateX(-50%)",
                background: "radial-gradient(closest-side, rgba(0,0,0,0.5), rgba(0,0,0,0) 70%)",
                filter: "blur(2px)",
              }}
            />
            <img
              src={mainPin}
              alt=""
              className={step === 0 ? "onboarding-pin-wiggle" : ""}
              style={{ width: 34, display: "block", transformOrigin: "50% 100%" }}
            />
          </div>
        )}
        <MiniSearchBar active={step === 1} />
      </div>
    </div>
  );
}

/*
 * Notes-страница: тот же приём «виртуального мокапа» (685px), что и у карты.
 * Открывается снизу скриншота (продолжая движение вниз с карты) и сама
 * прокручивается наверх; верхний блюр + поиск сидят на виртуальном top:0/32
 * (то же место, что и на карте) и естественно появляются в кадре только
 * когда скролл доезжает до верха — отдельно включать их не нужно.
 */
function NotesPage({ step }: { step: number }) {
  const active = step === 3;
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    // Уходя со страницы не сбрасываем обратно вниз — иначе поверх горизонтального
    // свайпа на «друзей» дополнительно проигрывается вертикальный откат, и это
    // выглядит как двойное движение. Просто оставляем как есть, страница всё
    // равно скрыта за пределами карточки.
    if (!active || revealed) return;
    const t = setTimeout(() => setRevealed(true), AUTO_SCROLL_DELAY);
    return () => clearTimeout(t);
  }, [active, revealed]);
  const y = NOTES_SCROLL_Y[revealed ? 1 : 0];
  return (
    <div className="relative shrink-0 overflow-hidden" style={{ width: CARD_W, height: CARD_H, backgroundColor: "#fff" }}>
      <div
        className="absolute left-0 top-0 transition-transform duration-[1100ms] ease-out"
        style={{ width: CARD_W, height: MOCK_H, transform: `translateY(${y}px)` }}
      >
        <img src={notesPreview} alt="" className="absolute left-0 top-0" style={{ width: CARD_W }} />
        <img
          src={searchBlur}
          alt=""
          className="absolute top-0 pointer-events-none"
          style={{ left: "50%", width: EDGE_BLUR_W, height: NOTES_EDGE_BLUR_TOP_H, transform: "translateX(-50%) rotate(180deg)" }}
        />
        <MiniSearchBar active={false} />
      </div>
    </div>
  );
}

/*
 * Friends-страница: продолжает ту же виртуальную вертикаль — стартует сверху
 * (там же, где закончила Notes) и сама прокручивается дальше вниз.
 */
function FriendsPage({ step }: { step: number }) {
  const active = step === 4;
  const [revealed, setRevealed] = useState(false);
  useEffect(() => {
    // Как и в Notes — не откатываем обратно наверх при уходе со страницы,
    // чтобы не было лишнего движения поверх горизонтального свайпа.
    if (!active || revealed) return;
    const t = setTimeout(() => setRevealed(true), AUTO_SCROLL_DELAY);
    return () => clearTimeout(t);
  }, [active, revealed]);
  const y = FRIENDS_SCROLL_Y[revealed ? 1 : 0];
  return (
    <div className="relative shrink-0 overflow-hidden" style={{ width: CARD_W, height: CARD_H, backgroundColor: "#fff" }}>
      <div
        className="absolute left-0 top-0 transition-transform duration-[1100ms] ease-out"
        style={{ width: CARD_W, height: MOCK_H, transform: `translateY(${y}px)` }}
      >
        <img src={friendsPreview} alt="" className="absolute left-0 top-0" style={{ width: CARD_W }} />
        {/* Нижний блюр внутри мокапа — под низом реального контента (в отличие от
            карты и заметок список короче виртуальной высоты, снизу остаётся пустое
            место, которое нужно так же смягчить блюром, как и остальные экраны) */}
        <img
          src={searchBlur}
          alt=""
          className="absolute pointer-events-none"
          style={{
            left: "50%",
            top: MOCK_H - EDGE_BLUR_BOTTOM_H,
            width: EDGE_BLUR_W,
            height: EDGE_BLUR_BOTTOM_H,
            transform: "translateX(-50%)",
          }}
        />
      </div>
    </div>
  );
}

function OnboardingPreview({ step }: { step: number }) {
  const pageIndex = Math.max(0, Math.min(step - 2, 2));
  const activeTab = pageIndex === 0 ? "map" : pageIndex === 1 ? "notes" : "friends";
  return (
    // Тень — на внешней обёртке без overflow. Если повесить box-shadow и
    // overflow-hidden на один и тот же элемент, тень (и всё, что рисуется у
    // самого края скруглённого угла) обрезается квадратом по границе рамки
    // вместо скругления — отсюда были и обрубленная тень, и «выемки» в углах
    // блюра. overflow-hidden оставляем только на внутреннем контейнере.
    <div
      className="relative rounded-[20px] shrink-0"
      style={{ width: CARD_W, height: CARD_H, boxShadow: "0 24px 40px -12px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)" }}
    >
      <div className="relative w-full h-full rounded-[20px] overflow-hidden">
        <div
          className="flex h-full transition-transform duration-500 ease-out"
          style={{ width: CARD_W * 3, transform: `translateX(-${pageIndex * CARD_W}px)` }}
        >
          <MapPage step={step} />
          <NotesPage step={step} />
          <FriendsPage step={step} />
        </div>
        {/* Блюр-подложка под таббаром — появляется и исчезает вместе с ним (не отдельный слой) */}
        {step >= 2 && (
          <img
            src={searchBlur}
            alt=""
            className="absolute bottom-0 pointer-events-none"
            style={{ left: "50%", width: EDGE_BLUR_W, height: EDGE_BLUR_BOTTOM_H, transform: "translateX(-50%)", zIndex: 10 }}
          />
        )}
        {step >= 2 && <FixedTabBar active={activeTab} />}
      </div>
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
      {/* Прогресс-бар как сторис в Instagram: пройденные шаги — залиты полностью,
          текущий доливается CTA-градиентом за 10 секунд и по завершении анимации
          сам переключает на следующий шаг (на последнем — завершает онбординг).
          Ручной клик по кнопке "next" тоже работает как обычно и просто демонтирует
          недоигравшую анимацию текущего шага. */}
      <div className="flex gap-1 mb-12 shrink-0">
        {stepsContent.map((_, i) => (
          <div key={i} className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--mappy-surface-secondary)" }}>
            {i < step && <div className="h-full w-full rounded-full" style={{ background: "var(--mappy-gradient-cta)" }} />}
            {i === step && (
              <div
                className="h-full rounded-full onboarding-progress-active"
                style={{ background: "var(--mappy-gradient-cta)" }}
                onAnimationEnd={next}
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-10 flex-1">
        {step === 0 ? (
          <div key="h-0" className="onboarding-text-up text-center w-full">
            <p className="text-[28px] font-semibold leading-[32px] tracking-[-0.6px] text-black">{current.headingLine1}</p>
          </div>
        ) : (
          <div className="text-center w-full overflow-hidden">
            {/* "Основная навигация" не анимируется — появляется один раз и остаётся на месте, едет только вторая строка */}
            <p key="h-static" className="onboarding-text-up text-[28px] font-semibold leading-[32px] tracking-[-0.6px] text-black">
              {current.headingLine1}
            </p>
            <p key={`h2-${step}`} className={`${textAnimClass} text-[28px] font-semibold leading-[32px] tracking-[-0.6px] text-black`}>
              {current.headingLine2}
            </p>
          </div>
        )}

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
