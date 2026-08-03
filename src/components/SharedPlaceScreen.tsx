import { useEffect, useState } from "react";
import {
  ApiError,
  fetchSharedPlace,
  persistUser,
  saveSharedPlace,
  setToken as persistToken,
  type ApiUser,
  type SharedPlace,
} from "../lib/api";
import { categoryLabel } from "../types";
import { AuthScreen } from "./AuthScreen";
import { CategoryIcon } from "./CategoryIcon";
import { PhotoSwiper } from "./PhotoSwiper";
import { SinglePlaceMap } from "./SinglePlaceMap";
import { formatPlaceDate } from "../lib/formatDate";
import { CloseButton, CtaButton, RatingChip } from "./primitives";
import mapIcon from "../assets/icons/tab-map.webp";

/*
 * Публичная страница места по ссылке `/s/:token` — макет Figma 2137:9564
 * («PlaceDetailSharing»). Открывается без входа: смысл шеринга в том, чтобы
 * получатель сразу увидел место, а не упёрся в регистрацию (п.13 бэклога
 * «Дизайн — шеринг…»). Регистрация запускается только по нижней кнопке, и сразу
 * после неё место копируется получателю — отдельного шага «сохранить» нет.
 *
 * В макете нижняя кнопка подписана «Зарегестироваться» — это опечатка макета.
 */

type Session = { token: string; user: ApiUser; isNew: boolean };

export function SharedPlaceScreen({
  token,
  signedIn,
  onAuthenticated,
  onOpenApp,
}: {
  token: string;
  signedIn: boolean;
  onAuthenticated: (token: string, user: ApiUser, isNew: boolean) => void;
  onOpenApp: () => void;
}) {
  const [place, setPlace] = useState<SharedPlace | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "gone" | "failed">("loading");
  const [showMap, setShowMap] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [reloadSignal, setReloadSignal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    fetchSharedPlace(token)
      .then((loaded) => {
        if (cancelled) return;
        setPlace(loaded);
        setLoadState("ready");
      })
      .catch((error) => {
        if (cancelled) return;
        // 404 — единственный отказ публичного роута: «нет такой», «отозвана» и
        // «истекла» снаружи неразличимы намеренно. Всё остальное — связь,
        // таймаут или сбой сервера, и это стоит предложить повторить.
        setLoadState(error instanceof ApiError && error.status === 404 ? "gone" : "failed");
      });
    return () => {
      cancelled = true;
    };
  }, [token, reloadSignal]);

  // Сохранение и вход — один шаг. Токен кладём в хранилище до запроса: копию
  // создаёт авторизованный роут, а сессия к этому моменту уже настоящая.
  const saveToAccount = async (auth: Session | null) => {
    setSaving(true);
    setSaveError("");
    try {
      await saveSharedPlace(token);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Не удалось сохранить место");
      setSaving(false);
      return;
    }
    if (auth) onAuthenticated(auth.token, auth.user, auth.isNew);
    else onOpenApp();
  };

  const isSignedIn = signedIn || session !== null;

  if (loadState === "loading") {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white px-8 text-center">
        <p className="text-[16px] leading-5" style={{ color: "var(--mappy-text-secondary)" }}>
          Загружаем место…
        </p>
      </div>
    );
  }

  if (loadState !== "ready" || !place) {
    const gone = loadState === "gone";
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center gap-6 bg-white px-8 text-center">
        <div className="flex flex-col gap-2">
          <h1
            className="text-[28px] font-semibold leading-8 tracking-[-0.6px]"
            style={{ color: "var(--mappy-text-primary)" }}
          >
            {gone ? "Ссылка не работает" : "Не удалось открыть место"}
          </h1>
          <p className="text-[16px] leading-5" style={{ color: "var(--mappy-text-secondary)" }}>
            {gone
              ? "Возможно, срок ссылки истёк или её закрыли. Попросите поделиться заново."
              : "Проверьте соединение и попробуйте ещё раз."}
          </p>
        </div>
        <div className="w-full max-w-sm">
          <CtaButton onClick={gone ? onOpenApp : () => setReloadSignal((value) => value + 1)}>
            {gone ? "Открыть Mappy" : "Повторить"}
          </CtaButton>
        </div>
      </div>
    );
  }

  const createdAt = formatPlaceDate(place.createdAt);

  return (
    <div className="fixed inset-0 overflow-y-auto overflow-x-hidden bg-white">
      <div className="flex min-h-full flex-col gap-3 px-4 pb-[calc(env(safe-area-inset-bottom)+132px)] pt-[calc(env(safe-area-inset-top)+16px)]">
        <PhotoSwiper photos={place.photos} />

        <div className="mt-3 flex w-full flex-col gap-6">
          <div className="flex flex-col gap-2 px-1">
            {/* Тот же заголовок до трёх строк, что и в карточке места (2113:2653). */}
            <h1
              className="block max-h-[96px] overflow-hidden text-ellipsis text-[28px] font-semibold leading-8 tracking-[-0.6px] [overflow-wrap:anywhere] [word-break:break-word]"
              style={{
                color: "var(--mappy-text-primary)",
                display: "-webkit-box",
                WebkitBoxOrient: "vertical",
                WebkitLineClamp: 3,
              }}
            >
              {place.title}
            </h1>
            <div className="flex min-w-0 items-center gap-2">
              {place.rating > 0 && (
                <span className="[&>span]:h-[26px] [&>span]:rounded-[10px]">
                  <RatingChip rating={place.rating} />
                </span>
              )}
              <span
                className="min-w-0 truncate text-[20px] leading-6"
                style={{ color: "var(--mappy-text-secondary)" }}
              >
                {place.address}
              </span>
            </div>
            {createdAt && (
              <p
                className="text-[16px] font-medium leading-[18px] tracking-[-0.6px]"
                style={{ color: "#99a1af" }}
              >
                {createdAt}
              </p>
            )}
          </div>

          {/*
            Карта — кнопка, а не встроенный снимок: маленькая врезка нечитаема, а
            честно отрендерить статичный снимок MapLibre без отдельного сервера
            нечем. В макете кнопка уже нарисована именно так (2138:1152).
          */}
          <button
            type="button"
            onClick={() => setShowMap(true)}
            className="flex h-[54px] w-full items-center justify-center gap-1 rounded-[14px] px-4 py-3 text-[16px] font-medium leading-[18px] tracking-[-0.6px]"
            style={{ backgroundColor: "var(--mappy-surface-secondary)", color: "var(--mappy-text-primary)" }}
          >
            <img src={mapIcon} alt="" className="h-6 w-6 shrink-0 object-contain" />
            Посмотреть на карте
          </button>

          {place.categories.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {place.categories.map((category) => (
                <span
                  key={category}
                  className="inline-flex items-center justify-center gap-1 rounded-[14px] py-3 pl-2 pr-3 text-[16px] font-medium leading-[18px]"
                  style={{ backgroundColor: "var(--mappy-surface-primary)", color: "var(--mappy-text-primary)" }}
                >
                  <CategoryIcon category={category} />
                  {categoryLabel[category]}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 flex flex-col gap-2 bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-4">
        {saveError && (
          <p className="px-1 text-center text-[14px] font-medium" style={{ color: "#fb2c36" }}>
            {saveError}
          </p>
        )}
        <CtaButton
          onClick={() => {
            if (isSignedIn) void saveToAccount(session);
            else setShowAuth(true);
          }}
          disabled={saving}
        >
          {saving ? "Сохраняем…" : isSignedIn ? "Сохранить себе" : "Зарегистрироваться"}
        </CtaButton>
      </div>

      {showMap && <SinglePlaceMap place={place} onClose={() => setShowMap(false)} />}

      {showAuth && (
        <div className="fixed inset-0 z-50">
          <AuthScreen
            initialIntent="register"
            /*
              Шаг «установите приложение» здесь намеренно выключен: по ссылке
              приходит человек, который ещё ничего про Mappy не знает, и лишнее
              трение перед сохранением места отвергнуто в п.14 бэклога.
            */
            showInstallGuide={false}
            onAuthenticated={(newToken, newUser, isNew) => {
              persistToken(newToken);
              persistUser(newUser);
              const auth = { token: newToken, user: newUser, isNew };
              setSession(auth);
              setShowAuth(false);
              void saveToAccount(auth);
            }}
          />
          <div className="absolute left-4 top-[calc(env(safe-area-inset-top)+12px)] z-10">
            <CloseButton onClick={() => setShowAuth(false)} size={32} />
          </div>
        </div>
      )}
    </div>
  );
}
