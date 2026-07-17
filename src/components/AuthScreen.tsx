import { useState } from "react";
import { requestCode, verifyCode, completeProfile, type ApiUser } from "../lib/api";
import { CtaButton } from "./primitives";

// Токены взяты из макета (node 1564-15087/15115/16601, 1569-36106/36183)
const COLOR_HEADER = "#232323";
const COLOR_SECONDARY = "var(--mappy-text-secondary)"; // #4a5565
const COLOR_BRAND = "var(--mappy-pink)"; // #ff2056
const COLOR_DANGER = "#fb2c36";
const COLOR_INPUT_TEXT = "var(--mappy-text-primary)"; // #1e2939
const COLOR_INPUT_BG = "var(--mappy-surface-primary)"; // #f9fafb
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
  onAuthenticated: (token: string, user: ApiUser) => void;
}) {
  const [step, setStep] = useState<"email" | "code" | "profile">("email");
  const [intent, setIntent] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
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
      setStep("code");
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : "Не удалось отправить код");
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await verifyCode(email.trim(), code.trim());
      if (res.user.username) {
        onAuthenticated(res.token, res.user);
      } else {
        // Токен нужно сохранить сразу — следующий запрос (профиль) авторизован
        setPendingToken(res.token);
        setPendingUser(res.user);
        setStep("profile");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неверный код");
    } finally {
      setLoading(false);
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
      onAuthenticated(pendingToken, user);
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
    <div className="fixed inset-0 flex flex-col justify-center px-5 bg-white">
      <div className="flex flex-col gap-6 max-w-sm mx-auto w-full">
        {step === "email" && (
          <>
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

            <div className="flex flex-col gap-2">
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

            <div className="flex flex-col gap-6">
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
            <p
              className="text-[15px] text-center mb-2"
              style={{ color: "var(--mappy-text-secondary)" }}
            >
              Введите код из письма на {email}
            </p>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitCode()}
              placeholder="0000"
              inputMode="numeric"
              maxLength={4}
              className="h-[56px] px-4 rounded-[14px] text-[26px] tracking-[10px] text-center outline-none placeholder:text-[#99a1af]"
              style={inputStyle}
              autoFocus
            />
            {error && (
              <p className="text-[13px] text-center" style={{ color: "#fb2c36" }}>
                {error}
              </p>
            )}
            <CtaButton onClick={submitCode} disabled={!code.trim() || loading}>
              {loading ? "Проверяем…" : "Подтвердить"}
            </CtaButton>
            <button
              onClick={() => {
                setStep("email");
                setCode("");
                setError("");
              }}
              className="text-[14px] text-center"
              style={{ color: "var(--mappy-pink)" }}
            >
              Изменить email
            </button>
          </>
        )}

        {step === "profile" && (
          <>
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
            <CtaButton onClick={submitProfile} disabled={loading}>
              {loading ? "Сохраняем…" : "Дальше"}
            </CtaButton>
          </>
        )}
      </div>
    </div>
  );
}
