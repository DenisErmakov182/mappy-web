import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  requestCode,
  verifyCode,
  completeProfile,
  rateLimitRetryAfter,
  isConsentRequiredError,
  type ApiUser,
} from "../lib/api";
import { CloseButton, CtaButton } from "./primitives";
import { PRIVACY_VERSION, TERMS_VERSION, type LegalDocumentId } from "../legal/documents";

// Уходит на сервер вместе с согласием и хранится там: по этим числам потом
// отвечают на вопрос «какую именно редакцию человек принял».
const CONSENT_VERSIONS = {
  terms: TERMS_VERSION,
  privacy: PRIVACY_VERSION,
  ageConfirmed: true,
} as const;

// Длина кода входа. Держим одним числом: раньше четвёрка была рассыпана по
// пяти местам, и любое расхождение между ними ломало ввод молча.
const CODE_LENGTH = 6;

const RESEND_COOLDOWN_SEC = 25;

// Своя пауза укладывается в минуту, но сервер при лимите частоты может попросить
// подождать до десяти, поэтому формат должен переживать минуты.
function formatCountdown(totalSec: number): string {
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// Токены взяты из макета (node 1564-15087/15115/16601, 1569-36106/36183)
const COLOR_HEADER = "#232323";
const COLOR_SECONDARY = "var(--mappy-text-secondary)"; // #4a5565
const COLOR_BRAND = "var(--mappy-pink)"; // #ff2056
const COLOR_DANGER = "#fb2c36";
const COLOR_INPUT_TEXT = "var(--mappy-text-primary)"; // #1e2939
const COLOR_INPUT_BG = "var(--mappy-surface-secondary)"; // #f3f4f6
const TRACKING = "-0.6px";

const inputStyle = {
  backgroundColor: COLOR_INPUT_BG,
  color: COLOR_INPUT_TEXT,
  border: "1px solid transparent",
  letterSpacing: TRACKING,
} as const;

const inputErrorStyle = {
  ...inputStyle,
  border: `1px solid ${COLOR_DANGER}`,
} as const;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Тексты ошибок, которые бэкенд возвращает специально про ник (409 занят + zod-валидация формата)
const USERNAME_ERROR_MESSAGES = [
  "Этот ник уже занят",
  "Минимум 3 символа",
  "Максимум 20 символов",
  "Только латиница, цифры и _",
];

function FieldError({ text }: { text: string }) {
  return (
    <p className="text-[14px] font-medium pl-1" style={{ color: COLOR_DANGER, letterSpacing: TRACKING }}>
      {text}
    </p>
  );
}

/*
 * Строка с галочкой. Одна и та же на экране регистрации и на шаге «Создаём
 * аккаунт», поэтому вынесена — иначе одинаковый блок жил бы в двух местах и
 * разъехался бы при первой же правке.
 *
 * Вёрстка временная: собрана из существующего на экране чекбокса, макета на неё
 * ещё нет. Строки идут столбиком по левому краю, а не по центру, как было у
 * единственной строки: у двух центрированных строк квадратики не совпадают по
 * вертикали. Итоговый вид — за макетом.
 */
function CheckRow({
  checked,
  onToggle,
  label,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-2 items-start w-full">
      {/*
        Квадратик остаётся 14×14 как в макете, а нажимается область 42×42:
        псевдоэлемент растянут `-inset-3.5` поверх. Через padding сделать
        нельзя — он сдвинул бы саму галочку, а она выровнена по первой строке
        текста. 14 пикселей — заметно меньше минимальных 44 у Apple, и мимо
        такой цели промахиваются; при этом обе галочки блокируют кнопку, так что
        промах читается как «кнопка почему-то не работает».
      */}
      <button
        onClick={onToggle}
        className="relative w-3.5 h-3.5 mt-0.5 rounded-[2px] shrink-0 after:absolute after:-inset-3.5 after:content-['']"
        style={{
          border: "1px solid rgba(3,7,18,0.08)",
          backgroundColor: checked ? COLOR_BRAND : "transparent",
        }}
        aria-label={label}
        aria-pressed={checked}
      />
      <p
        className="text-[14px] leading-[18px]"
        style={{ color: COLOR_SECONDARY, letterSpacing: TRACKING }}
      >
        {children}
      </p>
    </div>
  );
}

/** Текст со ссылками на документы — тоже в двух местах. */
function LegalLinks({ onOpenLegal }: { onOpenLegal?: (id: LegalDocumentId) => void }) {
  return (
    <>
      Я согласен с{" "}
      <button
        type="button"
        onClick={() => onOpenLegal?.("terms")}
        className="underline underline-offset-2"
        style={{ color: COLOR_BRAND }}
      >
        Условиями использования
      </button>{" "}
      и{" "}
      <button
        type="button"
        onClick={() => onOpenLegal?.("privacy")}
        className="underline underline-offset-2"
        style={{ color: COLOR_BRAND }}
      >
        Политикой конфиденциальности
      </button>
    </>
  );
}

function isStandalonePwa() {
  const iosNavigator = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || iosNavigator.standalone === true;
}

// Пригласительная ссылка на регистрацию (app.mymappy.ru/register), без
// отдельного поддомена и без роутера — читаем путь один раз при заходе на
// экран и сразу чистим адресную строку, чтобы за пределами этого рендера
// приложение не знало о существовании такого пути.
function initialAuthIntent(): "login" | "register" {
  const isRegisterLink = window.location.pathname === "/register";
  if (isRegisterLink) window.history.replaceState(null, "", "/");
  return isRegisterLink ? "register" : "login";
}

type InstallGuideIconType = "glasses" | "book" | "star" | "home" | "markup" | "print";

function InstallGuideIcon({ type }: { type: InstallGuideIconType }) {
  if (type === "glasses") {
    return (
      <svg viewBox="0 0 24 24">
        <circle cx="7" cy="13" r="4" />
        <circle cx="17" cy="13" r="4" />
        <path d="M11 13h2M3 11l1-4M21 11l-1-4" />
      </svg>
    );
  }

  if (type === "book") {
    return (
      <svg viewBox="0 0 24 24">
        <path d="M3.5 5.5c3.1-1.3 5.9-.8 8.5 1.4v12c-2.6-2.2-5.4-2.7-8.5-1.4v-12Z" />
        <path d="M20.5 5.5c-3.1-1.3-5.9-.8-8.5 1.4v12c2.6-2.2 5.4-2.7 8.5-1.4v-12Z" />
      </svg>
    );
  }

  if (type === "star") {
    return (
      <svg viewBox="0 0 24 24">
        <path d="m12 2.8 2.85 5.78 6.38.93-4.62 4.5 1.09 6.35L12 17.37l-5.7 2.99 1.09-6.35-4.62-4.5 6.38-.93L12 2.8Z" />
      </svg>
    );
  }

  if (type === "home") {
    return (
      <svg viewBox="0 0 24 24">
        <rect x="4" y="4" width="16" height="16" rx="3" />
        <path d="M12 8v8M8 12h8" />
      </svg>
    );
  }

  if (type === "markup") {
    return (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="8" />
        <path d="m9.2 16.8 1.1-5.1 2.8-5.1 1.6 5.6.1 4.6M10.3 12.2h4.4" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24">
      <path d="M7 8V4h10v4M7 17H5.5A2.5 2.5 0 0 1 3 14.5v-4A2.5 2.5 0 0 1 5.5 8h13a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1-2.5 2.5H17" />
      <rect x="7" y="14" width="10" height="7" rx="1" />
    </svg>
  );
}

function InstallGuideAction({
  type,
  label,
  home = false,
}: {
  type: InstallGuideIconType;
  label: string;
  home?: boolean;
}) {
  return (
    <div className={`install-guide-action${home ? " install-guide-home-action" : ""}`}>
      <div className="install-guide-action-content">
        <span className="install-guide-action-icon">
          <InstallGuideIcon type={type} />
        </span>
        <span className="install-guide-action-label-wrap">
          <span className="install-guide-action-label">{label}</span>
        </span>
      </div>
    </div>
  );
}

function InstallGuideAnimation() {
  return (
    <div className="install-guide-stage" aria-hidden="true">
      <div className="install-guide-share-sheet-track">
        <div className="install-guide-share-sheet">
          <div className="install-guide-grabber" />
          <div className="install-guide-actions-list">
            <div className="install-guide-action-group">
              <InstallGuideAction type="glasses" label="Добавить в список для чтения" />
              <InstallGuideAction type="book" label="Добавить закладку" />
              <InstallGuideAction type="star" label="Добавить в избранное" />
              <InstallGuideAction type="home" label="На экран «Домой»" home />
            </div>
            <div className="install-guide-action-group">
              <InstallGuideAction type="markup" label="Добавить разметку" />
              <InstallGuideAction type="print" label="Напечатать" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RegistrationInstallNotice({ onClose }: { onClose: () => void }) {
  const [animationCycle, setAnimationCycle] = useState(0);

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const replayTimer = window.setInterval(() => {
      setAnimationCycle((cycle) => cycle + 1);
    }, 10_000);

    return () => window.clearInterval(replayTimer);
  }, []);

  return (
    <div className="install-guide-backdrop" role="presentation">
      <section
        className="install-guide-bottom-sheet"
        style={{ letterSpacing: TRACKING }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="install-guide-title"
      >
        <div className="install-guide-sheet-grabber" aria-hidden="true" />

        <div className="install-guide-content">
          <div className="flex flex-col gap-3 pr-8">
            <h2 id="install-guide-title" className="text-[20px] leading-[24px] font-medium" style={{ color: COLOR_INPUT_TEXT }}>
              Настоятельно рекомендуем
            </h2>
            <div className="flex flex-col gap-1 text-[16px] leading-[20px]" style={{ color: COLOR_SECONDARY }}>
              <p>Перед полноценной регистрацией установите приложение к себе на устройство</p>
              <p>
                Нажмите на кнопку <span className="font-medium">«На экран «Домой»»</span>
              </p>
              <p>Установка поможет вам приятнее пользоваться приложением!</p>
            </div>
          </div>

          <InstallGuideAnimation key={animationCycle} />
        </div>

        <div className="absolute right-4 top-[15px]">
          <CloseButton onClick={onClose} size={28} backgroundColor="var(--mappy-surface-primary)" />
        </div>

        <CtaButton onClick={onClose}>Сделаю!</CtaButton>
      </section>
    </div>
  );
}

export function AuthScreen({
  onAuthenticated,
  initialIntent,
  showInstallGuide = true,
  onOpenLegal,
}: {
  onAuthenticated: (token: string, user: ApiUser, isNew: boolean) => void;
  /** Задан там, где намерение известно заранее — например на публичной странице
   *  места, куда человек пришёл по ссылке и заводит аккаунт, а не входит. */
  initialIntent?: "login" | "register";
  /** Подсказка про установку PWA уместна не везде: перед сохранением места по
   *  ссылке она лишнее трение (решение п.14 бэклога «Дизайн — шеринг…»). */
  showInstallGuide?: boolean;
  /** Открыть документ поверх экрана входа. Не переход по адресу: иначе
   *  перезагрузка стёрла бы уже введённую почту и шаг, на котором человек стоит. */
  onOpenLegal?: (id: LegalDocumentId) => void;
}) {
  const [step, setStep] = useState<"email" | "code" | "consent" | "profile">("email");
  const [intent, setIntent] = useState<"login" | "register">(
    () => initialIntent ?? initialAuthIntent(),
  );
  const [installNoticeDismissed, setInstallNoticeDismissed] = useState(false);
  const [standalonePwa] = useState(isStandalonePwa);
  const [email, setEmail] = useState("");
  const [codeDigits, setCodeDigits] = useState<string[]>(() => Array(CODE_LENGTH).fill(""));
  const [resendIn, setResendIn] = useState(0);
  const [resending, setResending] = useState(false);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsernameInput] = useState("");
  const [agreed, setAgreed] = useState(false);
  // Отдельно от `agreed`: сервис заявляет 18+, и это заявление о факте, а не
  // принятие документа. Одна общая галочка сделала бы недоказуемым, что человек
  // подтвердил именно возраст.
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const consentGiven = agreed && ageConfirmed;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [firstNameError, setFirstNameError] = useState("");
  const [lastNameError, setLastNameError] = useState("");
  const [usernameError, setUsernameError] = useState("");

  // Сохраняем токен/юзера сразу после verify-code, чтобы шаг профиля мог
  // сходить в API (он требует авторизации), а сам onAuthenticated вызвать в конце.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<ApiUser | null>(null);
  const [pendingIsNew, setPendingIsNew] = useState(false);

  const submitEmail = async () => {
    if (!email.trim()) {
      setEmailError("Введите email");
      return;
    }
    if (!EMAIL_RE.test(email.trim())) {
      setEmailError("Введите корректный адрес почты");
      return;
    }
    setLoading(true);
    setEmailError("");
    try {
      await requestCode(email.trim());
      setCodeDigits(Array(CODE_LENGTH).fill(""));
      setResendIn(RESEND_COOLDOWN_SEC);
      setStep("code");
    } catch (e) {
      // Сервер ограничил частоту: показываем его паузу, а не свою — иначе
      // кнопка разблокируется раньше, чем запрос снова будет принят.
      const wait = rateLimitRetryAfter(e);
      if (wait !== null) setResendIn(wait);
      setEmailError(e instanceof Error ? e.message : "Не удалось отправить код");
    } finally {
      setLoading(false);
    }
  };

  // Тикающий таймер до разблокировки повторной отправки кода.
  // Тикает на любом шаге: лимит частоты может сработать ещё на вводе почты,
  // и тогда пауза, поставленная сервером, не должна застыть.
  useEffect(() => {
    if (resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [resendIn > 0]);

  const resendCode = async () => {
    if (resending || resendIn > 0) return;
    setResending(true);
    setError("");
    try {
      await requestCode(email.trim());
      setCodeDigits(Array(CODE_LENGTH).fill(""));
      setResendIn(RESEND_COOLDOWN_SEC);
      digitRefs.current[0]?.focus();
    } catch (e) {
      const wait = rateLimitRetryAfter(e);
      if (wait !== null) setResendIn(wait);
      setError(e instanceof Error ? e.message : "Не удалось отправить код");
    } finally {
      setResending(false);
    }
  };

  const submitCode = async (fullCode?: string) => {
    const value = fullCode ?? codeDigits.join("");
    if (value.length < CODE_LENGTH) return;
    setLoading(true);
    setError("");
    try {
      // Согласие отправляем, только если человек его действительно отметил.
      // Существующему пользователю оно не нужно — он принимал документы при
      // регистрации, и повторная запись означала бы принятие, которого не было.
      const res = await verifyCode(email.trim(), value, consentGiven ? CONSENT_VERSIONS : undefined);
      if (res.user.username) {
        onAuthenticated(res.token, res.user, res.isNew);
      } else {
        // Токен нужно сохранить сразу — следующий запрос (профиль) авторизован
        setPendingToken(res.token);
        setPendingUser(res.user);
        setPendingIsNew(res.isNew);
        setStep("profile");
      }
    } catch (e) {
      if (isConsentRequiredError(e)) {
        /*
         * Человек вошёл через «Войти», но адрес оказался незнакомым — значит это
         * регистрация, и документы он ещё не принимал. Код сервер намеренно не
         * израсходовал, поэтому просто показываем согласие и отправляем тот же
         * код повторно. Цифры не стираем: возвращаться к их вводу не нужно.
         */
        setStep("consent");
        setError("");
        return;
      }
      setError(e instanceof Error ? e.message : "Неверный код");
      setCodeDigits(Array(CODE_LENGTH).fill(""));
      digitRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const setDigit = (index: number, raw: string) => {
    const digits = raw.replace(/\D/g, "");
    if (error) setError("");

    // Вставка/автозаполнение (iOS подставляет весь код целиком в одно поле)
    if (digits.length > 1) {
      const next = digits.slice(0, CODE_LENGTH).split("");
      while (next.length < CODE_LENGTH) next.push("");
      setCodeDigits(next);
      const firstEmpty = next.findIndex((d) => !d);
      if (firstEmpty === -1) submitCode(next.join(""));
      else digitRefs.current[firstEmpty]?.focus();
      return;
    }

    const next = [...codeDigits];
    next[index] = digits;
    setCodeDigits(next);
    if (digits && index < CODE_LENGTH - 1) {
      digitRefs.current[index + 1]?.focus();
    }
    if (digits && index === 3 && next.every(Boolean)) {
      submitCode(next.join(""));
    }
  };

  const onDigitKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !codeDigits[index] && index > 0) {
      digitRefs.current[index - 1]?.focus();
    }
  };

  const submitProfile = async () => {
    if (!pendingToken || !pendingUser) return;

    const fnError = firstName.trim() ? "" : "Введите имя";
    const lnError = lastName.trim() ? "" : "Введите фамилию";
    const unError = username.trim() ? "" : "Введите никнейм";
    setFirstNameError(fnError);
    setLastNameError(lnError);
    setUsernameError(unError);
    if (fnError || lnError || unError) return;

    setLoading(true);
    setError("");
    try {
      localStorage.setItem("mappy_token", pendingToken);
      const user = await completeProfile(firstName.trim(), lastName.trim(), username.trim());
      onAuthenticated(pendingToken, user, pendingIsNew);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Не удалось сохранить профиль";
      if (USERNAME_ERROR_MESSAGES.includes(message)) {
        setUsernameError(message);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen flex flex-col px-5 bg-white">
      {step === "email" && (
        <>
          <div className="flex flex-col gap-6 max-w-sm mx-auto w-full pt-[var(--mappy-registration-heading-top)]">
            <div className="flex flex-col items-center gap-2 text-center" style={{ letterSpacing: TRACKING }}>
              <h1 className="text-[28px] leading-[32px] font-semibold" style={{ color: COLOR_HEADER }}>
                {intent === "login" ? "Войдите в аккаунт" : "Создайте аккаунт"}
              </h1>
              <p className="text-[16px] leading-[20px]" style={{ color: COLOR_HEADER }}>
                {intent === "login" ? "Вернитесь к своим воспоминаниям!" : "Создайте воспоминания!"}
              </p>
              <div className="flex items-center gap-2.5 text-[16px] leading-[20px]">
                <span style={{ color: COLOR_HEADER }}>
                  {intent === "login" ? "Нет аккаунта?" : "Есть аккаунт?"}
                </span>
                <button
                  onClick={() => {
                    setIntent(intent === "login" ? "register" : "login");
                    setEmailError("");
                  }}
                  className="font-medium"
                  style={{ color: COLOR_BRAND }}
                >
                  {intent === "login" ? "Зарегистрироваться" : "Войти"}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (emailError) setEmailError("");
                }}
                onKeyDown={(e) => e.key === "Enter" && submitEmail()}
                placeholder="Почта"
                inputMode="email"
                className="h-[50px] px-4 rounded-[14px] text-[16px] font-medium outline-none placeholder:text-[#99a1af]"
                style={emailError ? inputErrorStyle : inputStyle}
                autoFocus
              />
              {emailError && <FieldError text={emailError} />}
            </div>

          </div>

          {/*
            Кнопка и галочки — один блок, как в макете. Раньше галочки жили
            отдельным `absolute bottom-6`: с одной строкой это работало, но
            вторая строка не поместилась в зазор до кнопки и полезла под неё.
            Опустить блок ниже нельзя — упрётся в home indicator, а safe area
            на этом экране уже однажды чинили. Поэтому стопка растёт вверх от
            того же безопасного отступа, что и раньше у одной кнопки.

            Вертикальный ритм снят с макета приблизительно; точные отступы —
            по ноде, когда она будет.
          */}
          <div
            className="auth-primary-cta max-w-sm mx-auto flex flex-col gap-5"
            style={
              intent === "register"
                ? // 34 пикселя по макету — ровно высота home indicator. Берём
                  // максимум с реальным системным отступом: на устройствах, где
                  // он больше, блок не должен под него залезать.
                  { bottom: "max(34px, env(safe-area-inset-bottom))" }
                : undefined
            }
          >
            <CtaButton
              onClick={submitEmail}
              disabled={loading || (intent === "register" && !consentGiven)}
            >
              {loading ? "Отправляем…" : intent === "login" ? "Дальше" : "Создать"}
            </CtaButton>

            {intent === "register" && (
              /*
                Группа центрируется целиком, а строки внутри выровнены по левому
                краю — так квадратики стоят друг под другом. Ширина ограничена,
                чтобы строка про документы переносилась на две, как нарисовано.
              */
              <div className="flex justify-center">
                <div className="flex flex-col gap-2.5 w-full max-w-[280px]">
                  <CheckRow
                    checked={agreed}
                    onToggle={() => setAgreed(!agreed)}
                    label="Согласие с условиями"
                  >
                    <LegalLinks onOpenLegal={onOpenLegal} />
                  </CheckRow>
                  <CheckRow
                    checked={ageConfirmed}
                    onToggle={() => setAgeConfirmed(!ageConfirmed)}
                    label="Подтверждение совершеннолетия"
                  >
                    Мне есть 18 лет
                  </CheckRow>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {step === "code" && (
        <>
          <div className="flex flex-col items-center gap-[30px] max-w-[350px] mx-auto w-full pt-[var(--mappy-registration-heading-top)]">
            <div className="flex flex-col items-center gap-2.5 text-center" style={{ letterSpacing: TRACKING }}>
              <h1 className="text-[28px] leading-[32px] font-semibold" style={{ color: COLOR_HEADER }}>
                Введите код
              </h1>
              <p className="text-[16px] leading-[20px] w-[272px]" style={{ color: COLOR_HEADER }}>
                Он поступит к вам на почту
                <br />
                {email}
              </p>
            </div>

            <div className="flex flex-col items-center gap-1.5 w-full">
              {/* 6 полей по 55 с зазором 4 = 350 (нода 1945:22248) */}
              <div className="flex gap-1 items-center w-full">
                {codeDigits.map((digit, i) => (
                  <input
                    key={i}
                    ref={(el) => {
                      digitRefs.current[i] = el;
                    }}
                    value={digit}
                    onChange={(e) => setDigit(i, e.target.value)}
                    onKeyDown={(e) => onDigitKeyDown(i, e)}
                    inputMode="numeric"
                    maxLength={1}
                    disabled={loading}
                    className="flex-1 min-w-0 w-0 h-[66px] rounded-[14px] text-[26px] font-medium text-center outline-none disabled:opacity-60"
                    style={error ? inputErrorStyle : inputStyle}
                    autoFocus={i === 0}
                  />
                ))}
              </div>
              {error && <FieldError text={error} />}
            </div>

            <div className="flex flex-col items-center gap-[30px]">
              {resendIn > 0 ? (
                <p
                  className="flex gap-1 text-[14px] leading-[18px]"
                  style={{ color: "rgba(4,4,19,0.55)", letterSpacing: TRACKING }}
                >
                  Запросить повторно можно через {formatCountdown(resendIn)}
                </p>
              ) : (
                <button
                  onClick={resendCode}
                  disabled={resending}
                  className="text-[14px] leading-[18px] font-medium"
                  style={{ color: COLOR_BRAND, letterSpacing: TRACKING }}
                >
                  {resending ? "Отправляем…" : "Отправить код повторно"}
                </button>
              )}
              <button
                onClick={() => {
                  setStep("email");
                  setCodeDigits(Array(CODE_LENGTH).fill(""));
                  setError("");
                }}
                className="text-[16px] leading-[20px] underline decoration-dotted"
                style={{ color: "#559ae5", letterSpacing: TRACKING }}
              >
                Изменить почту
              </button>
            </div>
          </div>

          <div className="auth-primary-cta max-w-sm mx-auto">
            <CtaButton onClick={() => submitCode()} disabled={codeDigits.some((d) => !d) || loading}>
              {loading ? "Проверяем…" : "Дальше"}
            </CtaButton>
          </div>
        </>
      )}

      {/*
        Шаг появляется только у того, кто пришёл через «Войти» с незнакомой
        почтой: для него это на самом деле регистрация, а документы он не
        принимал. Код при этом уже проверен и всё ещё действует.
      */}
      {step === "consent" && (
        <>
          <div className="flex flex-col items-center gap-[30px] max-w-[350px] mx-auto w-full pt-[var(--mappy-registration-heading-top)]">
            <div className="flex flex-col items-center gap-2.5 text-center" style={{ letterSpacing: TRACKING }}>
              <h1 className="text-[28px] leading-[32px] font-semibold" style={{ color: COLOR_HEADER }}>
                Создаём аккаунт
              </h1>
              <p className="text-[16px] leading-[20px]" style={{ color: COLOR_HEADER }}>
                Такой почты у нас ещё нет, поэтому заведём новый аккаунт
              </p>
            </div>

            <div className="flex flex-col gap-2.5 w-full">
              <CheckRow
                checked={agreed}
                onToggle={() => setAgreed(!agreed)}
                label="Согласие с условиями"
              >
                <LegalLinks onOpenLegal={onOpenLegal} />
              </CheckRow>
              <CheckRow
                checked={ageConfirmed}
                onToggle={() => setAgeConfirmed(!ageConfirmed)}
                label="Подтверждение совершеннолетия"
              >
                Мне есть 18 лет
              </CheckRow>
            </div>

            {error && <FieldError text={error} />}
          </div>

          <div className="auth-primary-cta max-w-sm mx-auto">
            <CtaButton onClick={() => submitCode()} disabled={!consentGiven || loading}>
              {loading ? "Создаём…" : "Создать аккаунт"}
            </CtaButton>
          </div>
        </>
      )}

      {step === "profile" && (
        <>
          <div className="flex flex-col gap-6 max-w-sm mx-auto w-full pt-[var(--mappy-registration-heading-top)]">
            <div className="flex flex-col items-center gap-2 text-center" style={{ letterSpacing: TRACKING }}>
              <h1 className="text-[28px] leading-[32px] font-semibold" style={{ color: COLOR_HEADER }}>
                Познакомимся ближе!
              </h1>
              <p className="text-[16px] leading-[20px]" style={{ color: COLOR_HEADER }}>
                Будем рады узнать вас лучше!
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5">
                <input
                  value={firstName}
                  onChange={(e) => {
                    setFirstName(e.target.value);
                    if (firstNameError) setFirstNameError("");
                  }}
                  placeholder="Имя"
                  className="w-full h-[50px] px-4 rounded-[14px] text-[16px] font-medium outline-none placeholder:text-[#99a1af]"
                  style={firstNameError ? inputErrorStyle : inputStyle}
                  autoFocus
                />
                {firstNameError && <FieldError text={firstNameError} />}
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  value={lastName}
                  onChange={(e) => {
                    setLastName(e.target.value);
                    if (lastNameError) setLastNameError("");
                  }}
                  placeholder="Фамилия"
                  className="w-full h-[50px] px-4 rounded-[14px] text-[16px] font-medium outline-none placeholder:text-[#99a1af]"
                  style={lastNameError ? inputErrorStyle : inputStyle}
                />
                {lastNameError && <FieldError text={lastNameError} />}
              </div>
              <div className="flex flex-col gap-1.5">
                <input
                  value={username}
                  onChange={(e) => {
                    setUsernameInput(e.target.value.replace(/\s/g, ""));
                    if (usernameError) setUsernameError("");
                  }}
                  onKeyDown={(e) => e.key === "Enter" && submitProfile()}
                  placeholder="Ник"
                  className="w-full h-[50px] px-4 rounded-[14px] text-[16px] font-medium outline-none placeholder:text-[#99a1af]"
                  style={usernameError ? inputErrorStyle : inputStyle}
                />
                {usernameError && <FieldError text={usernameError} />}
              </div>
            </div>

            {error && (
              <p className="text-[13px] text-center" style={{ color: COLOR_DANGER }}>
                {error}
              </p>
            )}
          </div>

          <div className="auth-primary-cta max-w-sm mx-auto">
            <CtaButton onClick={submitProfile} disabled={loading}>
              {loading ? "Сохраняем…" : "Дальше"}
            </CtaButton>
          </div>
        </>
      )}

      {step === "email" && intent === "register" && showInstallGuide && !standalonePwa && !installNoticeDismissed && (
        <RegistrationInstallNotice onClose={() => setInstallNoticeDismissed(true)} />
      )}
    </div>
  );
}
