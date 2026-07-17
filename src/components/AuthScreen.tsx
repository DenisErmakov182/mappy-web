import { useState } from "react";
import { requestCode, verifyCode, setUsername as apiSetUsername, type ApiUser } from "../lib/api";
import { CtaButton } from "./primitives";

const inputStyle = {
  backgroundColor: "var(--mappy-surface-secondary)",
  color: "var(--mappy-text-primary)",
} as const;

export function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (token: string, user: ApiUser) => void;
}) {
  const [step, setStep] = useState<"email" | "code" | "username">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [username, setUsernameInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Сохраняем токен/юзера сразу после verify-code, чтобы шаг выбора ника мог
  // сходить в API (он требует авторизации), а сам onAuthenticated вызвать в конце.
  const [pendingToken, setPendingToken] = useState<string | null>(null);
  const [pendingUser, setPendingUser] = useState<ApiUser | null>(null);

  const submitEmail = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setError("");
    try {
      await requestCode(email.trim());
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить код");
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
        // Токен нужно сохранить сразу — следующий запрос (выбор ника) авторизован
        setPendingToken(res.token);
        setPendingUser(res.user);
        setStep("username");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неверный код");
    } finally {
      setLoading(false);
    }
  };

  const submitUsername = async () => {
    if (!username.trim() || !pendingToken || !pendingUser) return;
    setLoading(true);
    setError("");
    try {
      localStorage.setItem("mappy_token", pendingToken);
      const user = await apiSetUsername(username.trim());
      onAuthenticated(pendingToken, user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось сохранить ник");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex flex-col justify-center px-6 bg-white">
      <div className="flex flex-col gap-4 max-w-sm mx-auto w-full">
        <h1
          className="text-[32px] font-semibold text-center mb-2"
          style={{ color: "var(--mappy-pink)" }}
        >
          Mappy
        </h1>

        {step === "email" && (
          <>
            <p
              className="text-[15px] text-center mb-2"
              style={{ color: "var(--mappy-text-secondary)" }}
            >
              Введите email для входа
            </p>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitEmail()}
              placeholder="you@example.com"
              inputMode="email"
              className="h-[50px] px-4 rounded-[14px] text-[16px] outline-none placeholder:text-[#99a1af]"
              style={inputStyle}
              autoFocus
            />
            {error && (
              <p className="text-[13px] text-center" style={{ color: "#fb2c36" }}>
                {error}
              </p>
            )}
            <CtaButton onClick={submitEmail} disabled={!email.trim() || loading}>
              {loading ? "Отправляем…" : "Получить код"}
            </CtaButton>
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

        {step === "username" && (
          <>
            <p
              className="text-[15px] text-center mb-2"
              style={{ color: "var(--mappy-text-secondary)" }}
            >
              Придумай никнейм — по нему друзья будут тебя находить
            </p>
            <input
              value={username}
              onChange={(e) => setUsernameInput(e.target.value.replace(/\s/g, ""))}
              onKeyDown={(e) => e.key === "Enter" && submitUsername()}
              placeholder="nickname"
              className="h-[50px] px-4 rounded-[14px] text-[16px] outline-none placeholder:text-[#99a1af]"
              style={inputStyle}
              autoFocus
            />
            {error && (
              <p className="text-[13px] text-center" style={{ color: "#fb2c36" }}>
                {error}
              </p>
            )}
            <CtaButton onClick={submitUsername} disabled={!username.trim() || loading}>
              {loading ? "Сохраняем…" : "Продолжить"}
            </CtaButton>
          </>
        )}
      </div>
    </div>
  );
}
