import { useEffect, useState } from "react";
import type { Friend } from "../types";
import { fetchFriends, addFriendByUsername, type ApiFriend, type ApiUser } from "../lib/api";
import { CtaButton, Sheet } from "./primitives";
import friendsEmptyIllustration from "../assets/illustrations/friends-empty.png";
import pinMap from "../assets/illustrations/pin-map.png";
import searchIcon from "../assets/icons/search-icon.svg";

function toFriend(f: ApiFriend): Friend {
  return {
    id: f.id,
    name: f.name ?? f.username ?? "Без имени",
    username: f.username ?? "",
    avatarUrl: f.avatarUrl ?? undefined,
  };
}

/*
 * Экран друзей по макетам 1489:17535 (пусто) и 1489:17465 (полный).
 */
export function FriendsScreen({
  user,
  onLogout,
  onDeleteAccount,
}: {
  user: ApiUser;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
}) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetchFriends()
      .then((list) => setFriends(list.map(toFriend)))
      .catch(() => {});
  }, []);

  const visibleFriends = query.trim()
    ? friends.filter(
        (f) =>
          f.name.toLowerCase().includes(query.toLowerCase()) ||
          f.username.toLowerCase().includes(query.toLowerCase()),
      )
    : friends;

  return (
    <div className="h-full overflow-y-auto pb-32" style={{ backgroundColor: "var(--mappy-surface-primary)" }}>
      <div className="px-4 pt-[max(env(safe-area-inset-top),16px)] flex flex-col gap-1">
        <ProfileHeader user={user} onLogout={onLogout} onDeleteAccount={onDeleteAccount} />

        {friends.length === 0 ? (
          <div className="bg-white rounded-[24px] px-6 py-6 text-center">
            <p className="text-[20px] font-semibold mb-1" style={{ color: "var(--mappy-text-primary)" }}>
              Вы еще не добавили друзей
            </p>
            <p className="text-[14px] mb-2" style={{ color: "var(--mappy-text-secondary)" }}>
              Добавьте друзей-и находите
              <br />
              проверенные места
            </p>
            <img src={friendsEmptyIllustration} alt="" className="w-[215px] mx-auto mb-5" />
            <CtaButton onClick={() => setShowAdd(true)}>Добавить по нику</CtaButton>
          </div>
        ) : (
          <div className="bg-white rounded-[24px] px-4 py-4">
            <div
              className="flex items-center gap-2.5 h-[46px] px-4 rounded-[14px] mb-3"
              style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
            >
              <img src={searchIcon} alt="" className="w-5 h-5 shrink-0 opacity-70" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Поиск по друзьям"
                className="flex-1 bg-transparent outline-none text-[16px] placeholder:text-[#6b7280]"
                style={{ color: "var(--mappy-text-primary)" }}
              />
            </div>

            {/* Карточка «Главный исследователь недели» */}
            <div
              className="flex items-center justify-between rounded-[16px] px-4 py-3 mb-4"
              style={{ backgroundColor: "var(--mappy-surface-primary)" }}
            >
              <div>
                <p className="text-[12px] mb-1" style={{ color: "var(--mappy-text-secondary)" }}>
                  Главный исследователь недели
                </p>
                <div className="flex items-center gap-2">
                  <span className="text-[18px] font-semibold" style={{ color: "var(--mappy-text-primary)" }}>
                    {friends[0]?.username ?? "Lilman45"}
                  </span>
                  <span
                    className="text-[12px] font-medium px-2 py-1 rounded-full"
                    style={{ backgroundColor: "var(--mappy-brand-subtle)", color: "var(--mappy-pink)" }}
                  >
                    +2 новых места! ↗
                  </span>
                </div>
              </div>
              <img src={pinMap} alt="" className="w-[36px]" />
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-[15px]" style={{ color: "var(--mappy-text-secondary)" }}>
                {friends.length} Друзей
              </span>
              <button
                onClick={() => setShowAdd(true)}
                className="text-[15px] font-medium"
                style={{ color: "var(--mappy-pink)" }}
              >
                + Добавить друга
              </button>
            </div>

            {visibleFriends.map((friend, i) => (
              <div
                key={friend.id}
                className="flex items-center gap-3 py-2.5"
                style={{ borderTop: i > 0 ? "1px solid var(--mappy-divider)" : "none" }}
              >
                <Avatar name={friend.name} />
                <div>
                  <p className="text-[16px] font-semibold" style={{ color: "var(--mappy-text-primary)" }}>
                    {friend.name}
                  </p>
                  <p className="text-[13px]" style={{ color: "var(--mappy-text-secondary)" }}>
                    @{friend.username}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddFriendSheet
          onAdd={(friend) => setFriends((prev) => [...prev, friend])}
          onClose={() => setShowAdd(false)}
        />
      )}
    </div>
  );
}

function ProfileHeader({
  user,
  onLogout,
  onDeleteAccount,
}: {
  user: ApiUser;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "Удалить аккаунт насовсем? Все ваши места, фото и друзья будут удалены без возможности восстановления.",
      )
    ) {
      return;
    }
    setDeleting(true);
    try {
      await onDeleteAccount();
    } catch {
      setDeleting(false);
      window.alert("Не удалось удалить аккаунт, попробуйте ещё раз");
    }
  };
  const displayName = user.name ?? user.username ?? user.email;
  const initials = displayName
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="relative bg-white rounded-[24px] px-6 pt-6 pb-5 mb-1">
      <span
        className="absolute -top-2.5 left-6 text-[12px] font-medium px-2.5 py-1 rounded-full bg-white"
        style={{ color: "var(--mappy-pink)", border: "1px solid var(--mappy-pink)" }}
      >
        Базовый тариф
      </span>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[24px] font-semibold leading-[28px]" style={{ color: "var(--mappy-text-primary)" }}>
            {displayName}
          </p>
          {user.username && (
            <p className="text-[14px] mt-1.5" style={{ color: "var(--mappy-text-secondary)" }}>
              @{user.username}
            </p>
          )}
        </div>
        <div className="relative">
          <div
            className="w-[74px] h-[74px] rounded-full flex items-center justify-center text-[26px] font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #ffa1ad, #ff2056)" }}
          >
            {initials}
          </div>
          <button
            onClick={() => setShowMenu((v) => !v)}
            className="absolute -top-1 -right-1 w-[30px] h-[30px] rounded-full bg-white shadow flex items-center justify-center"
            aria-label="Настройки"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="3" stroke="#4A5565" strokeWidth="1.8" />
              <path
                d="M19 12a7 7 0 00-.1-1.2l2-1.5-2-3.4-2.3 1a7 7 0 00-2-1.2L14.2 3h-4l-.4 2.5a7 7 0 00-2 1.2l-2.3-1-2 3.4 2 1.5A7 7 0 005.4 12a7 7 0 00.1 1.2l-2 1.5 2 3.4 2.3-1a7 7 0 002 1.2l.4 2.5h4l.4-2.5a7 7 0 002-1.2l2.3 1 2-3.4-2-1.5a7 7 0 00.1-1.2z"
                stroke="#4A5565"
                strokeWidth="1.5"
              />
            </svg>
          </button>
          {showMenu && (
            <div className="absolute top-9 right-0 bg-white rounded-[14px] shadow-lg py-1.5 w-[160px] z-10">
              <p
                className="px-4 py-2 text-[13px] truncate"
                style={{ color: "var(--mappy-text-secondary)" }}
                title={user.email}
              >
                {user.email}
              </p>
              <button
                onClick={onLogout}
                className="w-full text-left px-4 py-2 text-[15px] font-medium"
                style={{ color: "var(--mappy-text-primary)" }}
              >
                Выйти
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="w-full text-left px-4 py-2 text-[15px] font-medium disabled:opacity-50"
                style={{ color: "#fb2c36" }}
              >
                {deleting ? "Удаление..." : "Удалить аккаунт"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-semibold text-white shrink-0"
      style={{ background: "linear-gradient(135deg, #99a1af, #4a5565)" }}
    >
      {initials}
    </div>
  );
}

function AddFriendSheet({ onAdd, onClose }: { onAdd: (friend: Friend) => void; onClose: () => void }) {
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!value.trim() || loading) return;
    setLoading(true);
    setError("");
    try {
      const friend = await addFriendByUsername(value.trim());
      onAdd(toFriend(friend));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось добавить друга");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet onClose={onClose}>
      <div className="px-5 pb-4">
        <h2 className="text-[24px] font-semibold mb-4" style={{ color: "var(--mappy-text-primary)" }}>
          Добавить друга
        </h2>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/^@/, ""))}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Никнейм"
          className="w-full h-[46px] px-4 rounded-[14px] text-[16px] outline-none mb-4 placeholder:text-[#99a1af]"
          style={{ backgroundColor: "var(--mappy-surface-secondary)", color: "var(--mappy-text-primary)" }}
          autoFocus
        />
        {error && (
          <p className="text-[13px] text-center mb-3" style={{ color: "#fb2c36" }}>
            {error}
          </p>
        )}
        <CtaButton onClick={submit} disabled={!value.trim() || loading}>
          {loading ? "Добавляем…" : "Добавить"}
        </CtaButton>
      </div>
    </Sheet>
  );
}
