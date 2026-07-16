import { useState } from "react";
import type { Friend } from "../types";

export function FriendsList() {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [username, setUsername] = useState("");

  const addFriend = () => {
    if (!username.trim()) return;
    setFriends((prev) => [...prev, { id: crypto.randomUUID(), name: username.trim(), username: username.trim() }]);
    setUsername("");
    setShowAdd(false);
  };

  return (
    <div className="h-full overflow-y-auto pt-4 pb-28 px-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[22px] font-semibold">Друзья</h1>
        <button
          onClick={() => setShowAdd(true)}
          className="w-9 h-9 rounded-full flex items-center justify-center text-lg"
          style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
        >
          +
        </button>
      </div>

      {friends.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center gap-2 mt-20 text-gray-500">
          <span className="text-4xl">👥</span>
          <p className="text-[16px] font-medium text-black">Друзей нет</p>
          <p className="text-[14px]">Добавьте друзей, чтобы смотреть их сохранённые места</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {friends.map((friend) => (
            <div key={friend.id} className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full" style={{ backgroundColor: "var(--mappy-surface-secondary)" }} />
              <div>
                <p className="text-[16px] font-semibold">{friend.name}</p>
                <p className="text-[13px] text-gray-500">@{friend.username}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/30" onClick={() => setShowAdd(false)}>
          <div
            className="w-full sm:max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <button onClick={() => setShowAdd(false)} className="text-[15px] text-gray-500">
                Отмена
              </button>
              <span className="text-[16px] font-semibold">Добавить друга</span>
              <button
                onClick={addFriend}
                disabled={!username.trim()}
                className="text-[15px] font-semibold disabled:opacity-30"
                style={{ color: "var(--mappy-pink)" }}
              >
                Добавить
              </button>
            </div>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Поиск по номеру или нику"
              className="w-full h-12 px-4 rounded-xl text-[16px] outline-none"
              style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
              autoFocus
            />
          </div>
        </div>
      )}
    </div>
  );
}
