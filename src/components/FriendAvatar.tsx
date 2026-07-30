import { avatarGradient, avatarInitials } from "../lib/avatarGradient";

export interface AvatarPerson {
  id: string;
  name?: string | null;
  username?: string | null;
  avatarUrl?: string | null;
}

/*
 * Аватар друга поверх фото места. Обе карточки — на карте и в «Сохранённых» —
 * рисуют это одинаково.
 *
 * Круглого блика из макета (узел Figma 1829:21592) здесь намеренно нет: он снят
 * по решению владельца. Прежняя реализация через `friend-avatar-blur.svg` всё
 * равно не работала — `backdrop-filter` внутри `<foreignObject>` не может
 * размыть фотографию, когда SVG подключён через `<img src>`, потому что
 * такой SVG рисуется изолированно и позади него ничего нет.
 */
export function FriendAvatarOnPhoto({ person }: { person: AvatarPerson }) {
  return (
    <FriendAvatar
      person={person}
      className="absolute left-[5px] top-[5px] z-10 border-2 border-[#f3f4f6]"
    />
  );
}

/** Аватар друга: фото, а если его нет — инициалы на цветной подложке из его id. */
export function FriendAvatar({
  person,
  size = 40,
  className = "",
}: {
  person: AvatarPerson;
  size?: number;
  className?: string;
}) {
  const name = person.name ?? person.username ?? "Без имени";

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(14, Math.round(size * 0.28)),
        // Под фото подложка не нужна, но серый фон остаётся: пока картинка
        // грузится, цветной круг мигал бы и сменялся фотографией.
        background: person.avatarUrl ? "#e5e7eb" : avatarGradient(person.id),
      }}
      title={name}
    >
      {person.avatarUrl ? (
        <img src={person.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
      ) : (
        avatarInitials(name)
      )}
    </span>
  );
}
