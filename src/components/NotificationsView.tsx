import type { ApiFriend, ApiNotification } from "../lib/api";
import { BackIcon, SmallAvatar } from "./FriendsScreen";

/*
 * Лента уведомлений (макет 2029:57632). Пуши не подключены — это входящий
 * список, который экран «Друзья» опрашивает сам. Каждое уведомление — своя
 * белая карточка radius 28 с зазором 16px, а не строки внутри одной секции:
 * в макете карточки визуально разделены, а не подчёркнуты линией.
 */

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "только что";
  if (minutes < 60) return `${minutes} мин назад`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours === 1 ? "час назад" : `${hours} ч назад`;
  if (hours < 48) return "вчера";
  return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

// Тег по компоненту Tag/Size=m: серая пилюля 16px текста. Категория и время —
// два таких тега в одном ряду, а не чип + отдельная подпись.
function Tag({ children }: { children: string }) {
  return (
    <span
      className="inline-flex h-4 items-center whitespace-nowrap text-[12px] leading-4"
      style={{ color: "var(--mappy-text-tertiary)" }}
    >
      {children}
    </span>
  );
}

export function NotificationsView({
  items,
  loading,
  onBack,
  onOpenFriendRequest,
}: {
  items: ApiNotification[];
  loading: boolean;
  onBack: () => void;
  /* Кнопок в карточке нет (макет 2029:57632, Property 1=Friend) — тап по всей
     карточке открывает профиль отправителя, где уже есть Принять/Отклонить. */
  onOpenFriendRequest: (friendRequest: { id: string | null; user: ApiFriend }) => void;
}) {
  const unreadCount = items.filter((item) => !item.read).length;

  return (
    <div className="relative h-full bg-[var(--mappy-surface-primary)]">
      {/* Список — самый нижний слой: едет под блюром и под шапкой при скролле
          (макет 2029:57632, z-порядок: список → блюр → StatusBar → шапка). */}
      <div
        className="absolute inset-0 overflow-y-auto pb-32"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 92px)" }}
      >
        <div className="px-4">
          {loading && items.length === 0 && (
            <p className="pt-6 text-center text-[15px]" style={{ color: "var(--mappy-text-secondary)" }}>
              Загружаем…
            </p>
          )}

          {!loading && items.length === 0 && (
            <div className="rounded-[28px] bg-white px-6 py-8 text-center">
              <p className="text-[20px] font-semibold text-[var(--mappy-text-primary)]">Пока пусто</p>
              <p className="mt-2 text-[14px] text-[var(--mappy-text-secondary)]">
                Здесь появятся запросы в друзья и новости об обновлениях
              </p>
            </div>
          )}

          <div className="flex flex-col gap-4">
            {items.map((item) => (
              <NotificationCard key={item.id} item={item} onOpenFriendRequest={onOpenFriendRequest} />
            ))}
          </div>
        </div>
      </div>

      <div className="blur-edge-top" />

      {/* Шапка слита в одну карточку (макет 2030:58430): назад + заголовок —
          не раздельные плавающие элементы, а единая белая пилюля поверх блюра. */}
      <div
        className="absolute left-4 right-4 z-20 flex h-[60px] items-center justify-center rounded-[28px] bg-white shadow-[0_20px_40px_rgba(30,41,57,0.12)]"
        style={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
      >
        <button
          type="button"
          onClick={onBack}
          aria-label="Назад"
          className="absolute left-4 inline-flex items-center text-[#99a1af]"
        >
          <BackIcon />
        </button>
        <h1 className="flex items-center gap-2 text-[24px] font-semibold leading-7 text-[var(--mappy-text-primary)]">
          Уведомления
          {unreadCount > 0 && <span style={{ color: "var(--mappy-text-tertiary)" }}>{unreadCount}</span>}
        </h1>
      </div>
    </div>
  );
}

function NotificationCard({
  item,
  onOpenFriendRequest,
}: {
  item: ApiNotification;
  onOpenFriendRequest: (friendRequest: { id: string | null; user: ApiFriend }) => void;
}) {
  const category = item.type === "friend_request" ? "Друзья" : "Обновления";
  const when = formatWhen(item.createdAt);

  const body =
    item.type === "friend_request" && item.friendRequest ? (
      <div className="flex items-center gap-3">
        <SmallAvatar person={item.friendRequest.user} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-semibold leading-[18px]" style={{ color: "var(--mappy-text-primary)" }}>
            {item.friendRequest.user.name ?? item.friendRequest.user.username ?? "Кто-то"}
          </p>
          <p className="mt-1 truncate text-[14px] leading-[18px]" style={{ color: "var(--mappy-text-secondary)" }}>
            Хочет добавить вас в друзья
          </p>
        </div>
      </div>
    ) : (
      <div>
        <p className="text-[16px] font-semibold leading-[18px]" style={{ color: "var(--mappy-text-primary)" }}>
          {item.release?.title || "Обновление"}
        </p>
        {item.release?.body && (
          <p className="mt-1 text-[14px] leading-[18px]" style={{ color: "var(--mappy-text-secondary)" }}>
            {item.release.body}
          </p>
        )}
      </div>
    );

  const card = (
    <div className="flex w-full flex-col gap-2 rounded-[28px] bg-white p-4 text-left">
      <div className="flex items-center gap-2">
        <Tag>{category}</Tag>
        {when && <Tag>{when}</Tag>}
      </div>
      {body}
    </div>
  );

  if (item.type !== "friend_request" || !item.friendRequest) return card;

  const who = item.friendRequest.user.name ?? item.friendRequest.user.username ?? "пользователя";
  return (
    <button
      type="button"
      onClick={() => onOpenFriendRequest(item.friendRequest!)}
      aria-label={`Открыть запрос от ${who}`}
    >
      {card}
    </button>
  );
}
