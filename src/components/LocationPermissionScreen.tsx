import { useState } from "react";
import pinMap from "../assets/illustrations/pin-map.png";
import { CtaButton } from "./primitives";

type Coordinates = { lat: number; lng: number };

export function LocationPermissionScreen({
  onLocated,
  onContinueWithoutLocation,
}: {
  onLocated: (coordinates: Coordinates) => void;
  onContinueWithoutLocation: () => void;
}) {
  const [status, setStatus] = useState<"idle" | "requesting" | "error">("idle");
  const [error, setError] = useState("");

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setStatus("error");
      setError("Этот браузер не передаёт геолокацию. Можно открыть карту без неё.");
      return;
    }

    setStatus("requesting");
    setError("");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => onLocated({ lat: coords.latitude, lng: coords.longitude }),
      (geolocationError) => {
        setStatus("error");
        setError(
          geolocationError.code === geolocationError.PERMISSION_DENIED
            ? "Доступ к геолокации выключен. Разрешите его в настройках браузера или откройте карту без геолокации."
            : "Не удалось определить местоположение. Попробуйте ещё раз или откройте карту без геолокации.",
        );
      },
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 60_000 },
    );
  };

  return (
    <div className="fixed inset-0 bg-white flex flex-col overflow-y-auto px-5 pt-[max(env(safe-area-inset-top),28px)]">
      <div className="flex-1 flex flex-col items-center justify-center text-center pb-[220px]">
        <img src={pinMap} alt="" className="w-[220px] max-w-[62vw] h-auto object-contain mb-10" />
        <h1 className="text-[28px] font-semibold leading-[32px] tracking-[-0.6px] text-black max-w-[340px]">
          Сначала найдём вас на карте
        </h1>
        <p className="mt-4 max-w-[350px] text-[16px] leading-[22px]" style={{ color: "var(--mappy-text-secondary)" }}>
          Mappy использует геолокацию, чтобы сразу открыть карту рядом с вами, а не в случайном городе.
          Последняя позиция сохранится только на этом устройстве для следующего запуска.
        </p>
        {error && (
          <p className="mt-5 max-w-[350px] text-[14px] leading-[19px] font-medium" style={{ color: "#fb2c36" }}>
            {error}
          </p>
        )}
      </div>

      <div className="absolute left-5 right-5 bottom-[var(--mappy-primary-cta-bottom)] flex flex-col gap-3">
        <button
          onClick={onContinueWithoutLocation}
          disabled={status === "requesting"}
          className="w-full h-14 rounded-[14px] text-[16px] font-medium disabled:opacity-50"
          style={{ backgroundColor: "rgba(3,7,18,0.04)", color: "var(--mappy-text-primary)" }}
        >
          Открыть карту без геолокации
        </button>
        <CtaButton onClick={requestLocation} disabled={status === "requesting"}>
          {status === "requesting" ? "Определяем местоположение…" : status === "error" ? "Попробовать ещё раз" : "Разрешить геолокацию"}
        </CtaButton>
      </div>
    </div>
  );
}
