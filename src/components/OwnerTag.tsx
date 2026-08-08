import type { Friend } from "../types";
import { FriendAvatar } from "./FriendAvatar";

/*
 * Именной тег автора в карточке чужого места, нода Figma 2189:31714
 * («Friend Card»): аватар, имя и ник под ним. Данные приходят готовыми
 * в `place.owner`.
 *
 * Не кликабельный — переход в профиль отложен (решение владельца
 * 07.08.2026). Причина не в сложности самого тапа, а в навигации: профиль
 * друга живёт во внутреннем состоянии `FriendsScreen`, а карточка места
 * открывается шитом поверх карты, и переход означал бы закрыть шит,
 * переключить вкладку и открыть профиль через верхнеуровневое состояние
 * `App.tsx` — задача про router/state-machine из бэклога.
 */
export function OwnerTag({ owner }: { owner: Friend }) {
  const name = owner.name || owner.username;

  return (
    <div
      className="flex w-full items-center gap-3 rounded-[28px] p-3"
      style={{ backgroundColor: "var(--mappy-surface-primary)" }}
    >
      <FriendAvatar person={owner} size={40} />
      <div className="flex min-w-0 flex-col gap-1">
        <p
          className="truncate text-[16px] font-medium leading-[18px] tracking-[-0.6px]"
          style={{ color: "var(--mappy-text-primary)" }}
        >
          {name}
        </p>
        <p
          className="truncate text-[12px] leading-4 tracking-[-0.6px]"
          style={{ color: "var(--mappy-text-secondary)" }}
        >
          @{owner.username}
        </p>
      </div>
    </div>
  );
}
