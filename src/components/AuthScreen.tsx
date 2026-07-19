import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { requestCode, verifyCode, completeProfile, type ApiUser } from "../lib/api";
import { CtaButton } from "./primitives";

const RESEND_COOLDOWN_SEC = 25;

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

export function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (token: string, user: ApiUser, isNew: boolean) => void;
}) {
  const [step, setStep] = useState<"email" | "code" | "profile">("email");
  const [intent, setIntent] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [codeDigits, setCodeDigits] = useState(["", "", "", ""]);
  const [resendIn, setResendIn] = useState(0);
  const [resending, setResending] = useState(false);
  const digitRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsernameInput] = useState("");
  const [agreed, setAgreed] = useState(false);
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
      setCodeDigits(["", "", "", ""]);
      setResendIn(RESEND_COOLDOWN_SEC);
      setStep("code");
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Не удалось отправить код");
    } finally {
      setLoading(false);
    }
  };

  // Тикающий таймер до разблокировки повторной отправки кода
  useEffect(() => {
    if (step !== "code" || resendIn <= 0) return;
    const id = setInterval(() => setResendIn((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [step, resendIn > 0]);

  const resendCode = async () => {
    if (resending || resendIn > 0) return;
    setResending(true);
    setError("");
    try {
      await requestCode(email.trim());
      setCodeDigits(["", "", "", ""]);
      setResendIn(RESEND_COOLDOWN_SEC);
      digitRefs.current[0]?.focus();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить код");
    } finally {
      setResending(false);
    }
  };

  const submitCode = async (fullCode?: string) => {
    const value = fullCode ?? codeDigits.join("");
    if (value.length < 4) return;
    setLoading(true);
    setError("");
    try {
      const res = await verifyCode(email.trim(), value);
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
      setError(e instanceof Error ? e.message : "Неверный код");
      setCodeDigits(["", "", "", ""]);
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
      const next = digits.slice(0, 4).split("");
      while (next.length < 4) next.push("");
      setCodeDigits(next);
      const firstEmpty = next.findIndex((d) => !d);
      if (firstEmpty === -1) submitCode(next.join(""));
      else digitRefs.current[firstEmpty]?.focus();
      return;
    }

    const next = [...codeDigits];
    next[index] = digits;
    setCodeDigits(next);
    if (digits && index < 3) {
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
    <div className="fixed inset-0 flex flex-col px-5 bg-white">
      {step === "email" && (
        <>
          <div className="flex flex-col gap-6 max-w-sm mx-auto w-full pt-[110px]">
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

          <div className="flex flex-col gap-6 max-w-sm mx-auto w-full mt-auto pb-[120px]">
            <CtaButton
              onClick={submitEmail}
              disabled={loading || (intent === "register" && !agreed)}
            >
              {loading ? "Отправляем…" : intent === "login" ? "Дальше" : "Создать"}
            </CtaButton>

            {intent === "register" && (
              <div className="flex gap-2 items-start justify-center">
                <button
                  onClick={() => setAgreed(!agreed)}
                  className="w-3.5 h-3.5 mt-0.5 rounded-[2px] shrink-0"
                  style={{
                    border: "1px solid rgba(3,7,18,0.08)",
                    backgroundColor: agreed ? COLOR_BRAND : "transparent",
                  }}
                  aria-label="Согласие с условиями"
                />
                <p
                  className="text-[14px] leading-[18px] text-center"
                  style={{ color: COLOR_SECONDARY, letterSpacing: TRACKING }}
                >
                  Я согласен с <span style={{ color: COLOR_BRAND }}>Условиями использования</span> и{" "}
                  <span style={{ color: COLOR_BRAND }}>Политикой конфиденциальности</span>
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {step === "code" && (
        <>
          <div className="flex flex-col items-center gap-[30px] max-w-[324px] mx-auto w-full pt-[110px]">
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
              <div className="flex gap-3 items-center w-full">
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
                  Запросить повторно можно через 00:{String(resendIn).padStart(2, "0")}
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
                  setCodeDigits(["", "", "", ""]);
                  setError("");
                }}
                className="text-[16px] leading-[20px] underline decoration-dotted"
                style={{ color: "#559ae5", letterSpacing: TRACKING }}
              >
                Изменить почту
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-6 max-w-sm mx-auto w-full mt-auto pb-[120px]">
            <CtaButton onClick={() => submitCode()} disabled={codeDigits.some((d) => !d) || loading}>
              {loading ? "Проверяем…" : "Продолжить"}
            </CtaButton>
          </div>
        </>
      )}

      {step === "profile" && (
        <>
          <div className="flex flex-col gap-6 max-w-sm mx-auto w-full pt-[110px]">
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

          <div className="flex flex-col gap-6 max-w-sm mx-auto w-full mt-auto pb-[120px]">
            <CtaButton onClick={submitProfile} disabled={loading}>
              {loading ? "Сохраняем…" : "Дальше"}
            </CtaButton>
          </div>
        </>
      )}
    </div>
  );
}
