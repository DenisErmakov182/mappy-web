import { useState } from "react";
import { requestCode, verifyCode, type ApiUser } from "../lib/api";
import { CtaButton } from "./primitives";

const inputStyle = {
  backgroundColor: "var(--mappy-surface-secondary)",
  color: "var(--mappy-text-primary)",
} as const;

const channelLabel: Record<string, string> = {
  telegram: "из Telegram",
  telegram_bot: "из Telegram-бота",
  sms: "из SMS",
  dev: "подтверждения",
};

export function AuthScreen({
  onAuthenticated,
}: {
  onAuthenticated: (token: string, user: ApiUser) => void;
}) {
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [channel, setChannel] = useState<string | null>(null);
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submitPhone = async () => {
    if (!phone.trim()) return;
    setLoading(true);
    setError("");
    try {
      const res = await requestCode(phone.trim());
      setChannel(res.channel);
      setDeepLink(res.deepLink ?? null);
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
      const res = await verifyCode(phone.trim(), code.trim());
      onAuthenticated(res.token, res.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Неверный код");
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

        {step === "phone" ? (
          <>
            <p
              className="text-[15px] text-center mb-2"
              style={{ color: "var(--mappy-text-secondary)" }}
            >
              Введите номер телефона для входа
            </p>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitPhone()}
              placeholder="+7 900 000-00-00"
              inputMode="tel"
              className="h-[50px] px-4 rounded-[14px] text-[16px] outline-none placeholder:text-[#99a1af]"
              style={inputStyle}
              autoFocus
            />
            {error && (
              <p className="text-[13px] text-center" style={{ color: "#fb2c36" }}>
                {error}
              </p>
            )}
            <CtaButton onClick={submitPhone} disabled={!phone.trim() || loading}>
              {loading ? "Отправляем…" : "Получить код"}
            </CtaButton>
          </>
        ) : (
          <>
            <p
              className="text-[15px] text-center mb-2"
              style={{ color: "var(--mappy-text-secondary)" }}
            >
              Введите код {channelLabel[channel ?? "dev"]}
            </p>
            {deepLink && (
              <a
                href={deepLink}
                target="_blank"
                rel="noreferrer"
                className="cta-gradient w-full h-14 rounded-[14px] flex items-center justify-center gap-1 text-[16px] font-medium shrink-0"
              >
                Открыть Telegram и получить код
              </a>
            )}
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
                setStep("phone");
                setCode("");
                setError("");
              }}
              className="text-[14px] text-center"
              style={{ color: "var(--mappy-pink)" }}
            >
              Изменить номер
            </button>
          </>
        )}
      </div>
    </div>
  );
}
