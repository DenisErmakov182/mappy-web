import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  emptyFilters,
  filtersAreEmpty,
  placeMatchesFilters,
  type Friend,
  type Place,
  type PlaceFilters,
} from "../types";
import {
  acceptFriendRequest,
  cancelFriendRequest,
  fetchFriendPlaces,
  fetchFriendRequests,
  fetchFriends,
  fetchNotifications,
  markNotificationsRead,
  removeFriend,
  searchFriends,
  sendFriendRequest,
  type ApiFriend,
  type ApiFriendProfile,
  type ApiNotification,
  type ApiUser,
} from "../lib/api";
import { NotificationsView } from "./NotificationsView";
import { FriendAvatar } from "./FriendAvatar";
import { avatarGradient, avatarInitials } from "../lib/avatarGradient";
import { CtaButton, SearchIcon } from "./primitives";
import { PlaceRowCard } from "./PlaceRowCard";
import friendsEmptyIllustration from "../assets/illustrations/friends-empty.webp";
import friendsPreviewIllustration from "../assets/illustrations/friends-preview.png";
import friendPhotoPin from "../assets/icons/friend-photo-pin.png";
import filterIcon from "../assets/icons/filter-icon.svg";
import dotsHorizontalIcon from "../assets/icons/dots-horizontal.svg";
import { AccountScreen } from "./AccountScreen";
import { FilterSheet } from "./FilterSheet";

type FriendsView =
  | { kind: "home" }
  | { kind: "list" }
  | { kind: "requests" }
  | { kind: "notifications" }
  | { kind: "profile"; person: ApiFriendProfile };

function displayName(person: ApiFriend | ApiFriendProfile): string {
  return person.name ?? person.username ?? "Без имени";
}

function toFriend(person: ApiFriend | ApiFriendProfile): Friend {
  return {
    id: person.id,
    name: displayName(person),
    username: person.username ?? "",
    avatarUrl: person.avatarUrl ?? undefined,
  };
}

export function FriendsScreen({
  user,
  onLogout,
  onDeleteAccount,
  onUserUpdated,
  onOpenPlace,
  onFriendsChanged,
  resetSignal = 0,
}: {
  user: ApiUser;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
  onUserUpdated: (user: ApiUser) => void;
  onOpenPlace: (place: Place) => void;
  onFriendsChanged?: () => void;
  /** Растёт при тапе по уже активной вкладке «Друзья» — сигнал вернуться в корень. */
  resetSignal?: number;
}) {
  const [view, setView] = useState<FriendsView>({ kind: "home" });
  const [friends, setFriends] = useState<ApiFriendProfile[]>([]);
  const [incoming, setIncoming] = useState<ApiFriendProfile[]>([]);
  const [outgoing, setOutgoing] = useState<ApiFriendProfile[]>([]);
  const [showAccount, setShowAccount] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  const loadRelationships = async () => {
    try {
      const [friendRows, requests] = await Promise.all([fetchFriends(), fetchFriendRequests()]);
      setFriends(friendRows.map((friend) => ({ ...friend, relation: "friend" as const })));
      setIncoming(requests.incoming);
      setOutgoing(requests.outgoing);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить друзей");
    } finally {
      setLoading(false);
    }
  };

  // Пушей нет, поэтому ленту тянем сами. Не по таймеру: обновляем при открытии
  // экрана и при возврате приложения на передний план — этого достаточно, а
  // фоновый polling на телефоне стоил бы батареи.
  const loadNotifications = async () => {
    try {
      const feed = await fetchNotifications();
      setNotifications(feed.items);
      setUnreadCount(feed.unreadCount);
    } catch {
      // Молча: уведомления не должны ронять экран друзей.
    } finally {
      setNotificationsLoading(false);
    }
  };

  useEffect(() => {
    void loadRelationships();
    void loadNotifications();

    const onVisible = () => {
      if (document.visibilityState === "visible") void loadNotifications();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const openNotifications = async () => {
    setError("");
    setView({ kind: "notifications" });
    if (unreadCount === 0) return;
    setUnreadCount(0);
    setNotifications((prev) => prev.map((item) => ({ ...item, read: true })));
    try {
      await markNotificationsRead();
    } catch {
      // Не критично: при следующей загрузке счётчик пересчитается с сервера.
    }
  };

  // Повторный тап по уже активной вкладке «Друзья» возвращает экран в корень.
  // Это единственный выход с профиля друга, когда список его мест прокручен:
  // «Назад» и меню «…» уезжают вверх вместе с шапкой профиля, а липкая строка
  // поиска их не содержит (макет 2147:8263). Нулевой сигнал — первый рендер,
  // на нём сбрасывать нечего.
  useEffect(() => {
    if (resetSignal === 0) return;
    setError("");
    setView({ kind: "home" });
    setShowAccount(false);
  }, [resetSignal]);

  const openProfile = (person: ApiFriendProfile) => {
    setError("");
    setView({ kind: "profile", person });
  };

  const returnHome = () => {
    setError("");
    setView({ kind: "home" });
  };

  if (view.kind === "list") {
    return (
      <FriendsListView
        friends={friends}
        incoming={incoming}
        loading={loading}
        onBack={returnHome}
        onOpenRequests={() => setView({ kind: "requests" })}
        onOpenProfile={openProfile}
      />
    );
  }

  if (view.kind === "requests") {
    return (
      <RequestsView
        incoming={incoming}
        outgoing={outgoing}
        // «Запросы» открывается только с экрана списка (FriendsListView,
        // onOpenRequests) — назад должен возвращать туда же, на один шаг, а
        // не сразу в корень «Друзья» (был баг: onBack={returnHome} уводил
        // на корень, найдено и поправлено 14.08.2026 по фидбэку владельца).
        onBack={() => {
          setError("");
          setView({ kind: "list" });
        }}
        onOpenProfile={openProfile}
      />
    );
  }

  if (view.kind === "notifications") {
    return (
      <NotificationsView
        items={notifications}
        loading={notificationsLoading}
        onBack={returnHome}
        onOpenFriendRequest={(friendRequest) =>
          openProfile({
            id: friendRequest.user.id,
            name: friendRequest.user.name,
            username: friendRequest.user.username,
            avatarUrl: friendRequest.user.avatarUrl,
            relation: "incoming",
            requestId: friendRequest.id,
          })
        }
      />
    );
  }

  if (view.kind === "profile") {
    return (
      <FriendProfileView
        person={view.person}
        onBack={returnHome}
        onOpenPlace={onOpenPlace}
        onChanged={async (person, destination = "profile") => {
          await loadRelationships();
          onFriendsChanged?.();
          if (destination === "home") setView({ kind: "home" });
          else setView({ kind: "profile", person });
        }}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto pb-32" style={{ backgroundColor: "var(--mappy-surface-primary)" }}>
      <div className="flex flex-col gap-4 px-4 pt-[var(--mappy-floating-top)]">
        <ProfileHeader user={user} onOpenAccount={() => setShowAccount(true)} />

        {/* Отдельная карточка входа в ленту (макет 2026:57554) — одна и та же
            что при пустом списке друзей, что при заполненном. */}
        <button
          type="button"
          onClick={openNotifications}
          className="flex h-14 w-full items-center justify-between rounded-[28px] bg-white px-4 text-left"
        >
          <span className="text-[16px] font-medium" style={{ color: "var(--mappy-text-primary)" }}>
            Уведомления
          </span>
          {unreadCount > 0 && (
            <span
              className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[16px] font-medium text-white"
              style={{ backgroundColor: "#ff637e" }}
            >
              {unreadCount}
            </span>
          )}
        </button>

        {/* Карточка-превью «Друзья» (макеты 2026:57142 пустой / 2026:57183 с
            друзьями, 14.08.2026) — раньше поиск и список друзей жили прямо
            здесь; теперь это просто вход, вся карточка целиком кликабельна и
            ведёт на отдельный экран FriendsListView (там и поиск, и список,
            и «Запросы» — макет 2264:9330). Владелец подтвердил: пустое
            состояние тоже кликабельно, отдельного места для поиска на этом
            экране в макете нет. */}
        {friends.length === 0 && !loading ? (
          <button
            type="button"
            onClick={() => setView({ kind: "list" })}
            className="flex w-full flex-col items-start gap-2 rounded-[28px] bg-white p-4 text-left"
          >
            <span className="text-[16px] font-medium" style={{ color: "var(--mappy-text-primary)" }}>
              Друзья
            </span>
            <div className="flex w-full flex-col items-center gap-5 px-3 pt-1 text-center tracking-densed">
              <div className="flex flex-col items-center gap-2">
                <p className="text-[20px] font-medium leading-6" style={{ color: "var(--mappy-text-primary)" }}>
                  Вы еще не добавили друзей
                </p>
                <p className="text-[16px] leading-5" style={{ color: "var(--mappy-text-secondary)" }}>
                  Добавьте друзей - находите проверенные места
                </p>
              </div>
              <img src={friendsEmptyIllustration} alt="" className="w-[215px]" />
            </div>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setView({ kind: "list" })}
            className="relative flex h-[72px] w-full items-center overflow-hidden rounded-[28px] bg-white px-4 text-left"
          >
            <span className="text-[16px] font-medium" style={{ color: "var(--mappy-text-primary)" }}>
              Друзья <span style={{ color: "var(--mappy-text-tertiary)" }}>{friends.length}</span>
            </span>
            <img
              src={friendsPreviewIllustration}
              alt=""
              className="pointer-events-none absolute -right-1 -top-2 w-[175px]"
            />
          </button>
        )}

        {error && <p className="px-1 text-center text-[13px] text-[#fb2c36]">{error}</p>}
      </div>

      {showAccount && (
        <AccountScreen
          user={user}
          onClose={() => setShowAccount(false)}
          onUserUpdated={onUserUpdated}
          onLogout={onLogout}
          onDeleteAccount={onDeleteAccount}
        />
      )}
    </div>
  );
}

/*
 * Полный список друзей + поиск/добавление по нику — макет 2264:9330 (узел
 * назван «Friends / Search» в Figma, но по факту это общий экран списка:
 * владелец подтвердил, что своего узла с заполненным списком под строкой
 * поиска нет, строки друзей — переиспользованный PersonRow без изменений).
 * Раньше это всё жило прямо на корневом экране «Друзья» внутри одной
 * секции; вынесено сюда 14.08.2026 — на корне осталась только
 * кликабельная карточка-превью (см. FriendsScreen).
 */
function FriendsListView({
  friends,
  incoming,
  loading,
  onBack,
  onOpenRequests,
  onOpenProfile,
}: {
  friends: ApiFriendProfile[];
  incoming: ApiFriendProfile[];
  loading: boolean;
  onBack: () => void;
  onOpenRequests: () => void;
  onOpenProfile: (person: ApiFriendProfile) => void;
}) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ApiFriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const value = query.trim();
    if (!value) {
      setSearchResults([]);
      setSearching(false);
      return;
    }

    let active = true;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchFriends(value)
        .then((results) => {
          if (active) setSearchResults(results);
        })
        .catch((searchError) => {
          if (active) setError(searchError instanceof Error ? searchError.message : "Не удалось выполнить поиск");
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [query]);

  const hasSearch = Boolean(query.trim());

  return (
    <div className="relative h-full bg-[var(--mappy-surface-primary)]">
      {/* Список — под блюром и под шапкой при скролле, как в RequestsView. */}
      <div
        className="absolute inset-0 overflow-y-auto pb-32"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 152px)" }}
      >
        {friends.length === 0 && !loading && !hasSearch ? (
          // Пустое состояние здесь — только текст, без иллюстрации и CTA
          // (те остались на карточке-превью корневого экрана, дублировать их
          // тут не стали по просьбе владельца 14.08.2026) — и плашка по
          // центру доступной высоты экрана, а не прижата к шапке.
          <div className="flex h-full items-center justify-center px-4">
            <section className="rounded-[28px] bg-white px-6 py-8 text-center">
              <p className="text-[20px] font-semibold leading-6" style={{ color: "var(--mappy-text-primary)" }}>
                Вы еще не добавили друзей
              </p>
              <p className="mt-1 text-[14px] leading-5" style={{ color: "var(--mappy-text-secondary)" }}>
                Добавьте друзей — и находите
                <br />
                проверенные места
              </p>
            </section>
          </div>
        ) : (
        <div className="px-4">
          {hasSearch ? (
            <section className="rounded-[28px] bg-white p-4">
              {searching && <EmptyLine>Ищем…</EmptyLine>}
              {!searching && searchResults.length === 0 && <EmptyLine>Никого не нашли</EmptyLine>}
              {!searching && searchResults.map((person, index) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  border={index > 0}
                  suffix={<RelationLabel relation={person.relation} />}
                  onClick={() => onOpenProfile(person)}
                />
              ))}
            </section>
          ) : (
            <section className="rounded-[28px] bg-white p-4">
              {friends.map((friend, index) => (
                <PersonRow
                  key={friend.id}
                  person={friend}
                  border={index > 0}
                  onClick={() => onOpenProfile(friend)}
                />
              ))}
            </section>
          )}

          {error && <p className="mt-3 px-1 text-center text-[13px] text-[#fb2c36]">{error}</p>}
        </div>
        )}
      </div>

      <div className="blur-edge-top" />

      {/* Шапка (назад/заголовок+счётчик/«Запросы») и строка поиска слиты в
          одну карточку с тенью — тот же приём, что уже был в RequestsView,
          только тут заголовочная строка ещё и трёхчастная: назад слева,
          заголовок по центру, «Запросы» справа (макет 2264:9330). */}
      <div
        className="absolute left-4 right-4 z-20 rounded-[28px] bg-white shadow-[0_20px_40px_rgba(30,41,57,0.12)]"
        style={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
      >
        <div className="relative flex h-[52px] items-center justify-center px-4">
          <button
            type="button"
            onClick={onBack}
            aria-label="Назад"
            className="absolute left-4 inline-flex items-center text-[#99a1af]"
          >
            <BackIcon />
          </button>
          <h1 className="text-[20px] font-medium leading-6" style={{ color: "var(--mappy-text-primary)" }}>
            Друзья <span style={{ color: "var(--mappy-text-tertiary)" }}>{friends.length}</span>
          </h1>
          <button
            type="button"
            onClick={onOpenRequests}
            className="absolute right-4 inline-flex items-center gap-1 text-[16px] font-medium"
            style={{ color: "var(--mappy-text-tertiary)" }}
          >
            Запросы
            {incoming.length > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--mappy-pink)] px-1.5 text-[12px] leading-5 text-white">
                {incoming.length}
              </span>
            )}
            <ChevronRightIcon />
          </button>
        </div>
        <div className="px-2 pb-2">
          <label className="flex h-12 items-center gap-2.5 rounded-full bg-[var(--mappy-surface-secondary)] px-4">
            <SearchIcon
              className="h-6 w-6 shrink-0"
              color={query ? "var(--mappy-text-primary)" : "var(--mappy-text-tertiary)"}
            />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по людям"
              className="min-w-0 flex-1 bg-transparent text-[16px] text-[var(--mappy-text-primary)] outline-none placeholder:text-[var(--mappy-text-tertiary)]"
            />
          </label>
        </div>
      </div>
    </div>
  );
}

function RequestsView({
  incoming,
  outgoing,
  onBack,
  onOpenProfile,
}: {
  incoming: ApiFriendProfile[];
  outgoing: ApiFriendProfile[];
  onBack: () => void;
  onOpenProfile: (person: ApiFriendProfile) => void;
}) {
  const [activeTab, setActiveTab] = useState<"outgoing" | "incoming">(incoming.length > 0 ? "incoming" : "outgoing");
  // Список запросов у FriendsScreen грузится асинхронно и часто ещё пуст в
  // момент первого рендера этого экрана — тогда инициализатор useState выше
  // выбирает "outgoing" по умолчанию и больше не пересчитывается. Держим
  // выбор вкладки на актуальных данных, пока пользователь не переключил её сам.
  const userPickedTab = useRef(false);
  useEffect(() => {
    if (userPickedTab.current) return;
    if (incoming.length > 0) setActiveTab("incoming");
  }, [incoming.length]);
  const active = activeTab === "incoming" ? incoming : outgoing;

  return (
    <div className="relative h-full bg-[var(--mappy-surface-primary)]">
      {/* Список — под блюром и под шапкой при скролле, как в NotificationsView. */}
      <div
        className="absolute inset-0 overflow-y-auto pb-32"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 152px)" }}
      >
        {active.length === 0 ? (
          // По центру доступной высоты экрана — тот же приём, что и в
          // пустом состоянии FriendsListView (14.08.2026).
          <div className="flex h-full items-center justify-center px-4">
            <div className="rounded-[28px] bg-white px-6 py-8 text-center">
              <p className="text-[20px] font-semibold text-[var(--mappy-text-primary)]">Запросов нет</p>
              <p className="mt-2 text-[14px] text-[var(--mappy-text-secondary)]">
                Вероятно, вы уже со всеми подружились!
              </p>
            </div>
          </div>
        ) : (
          <div className="px-4">
            <div className="flex flex-col gap-3">
              {active.map((person) => (
                <section key={person.id} className="rounded-[28px] bg-white p-4">
                  <PersonRow person={person} padded={false} onClick={() => onOpenProfile(person)} />
                </section>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="blur-edge-top" />

      {/* Шапка слита в одну карточку (макет 2030:58431): назад + заголовок +
          вкладки — единая белая пилюля поверх блюра, а не части, разбросанные
          по скроллящемуся контенту. */}
      <div
        className="absolute left-4 right-4 z-20 rounded-[28px] bg-white shadow-[0_20px_40px_rgba(30,41,57,0.12)]"
        style={{ top: "calc(env(safe-area-inset-top) + 16px)" }}
      >
        <div className="relative flex h-[60px] items-center justify-center">
          <button
            type="button"
            onClick={onBack}
            aria-label="Назад"
            className="absolute left-4 inline-flex items-center text-[#99a1af]"
          >
            <BackIcon />
          </button>
          {/* 24px/semibold → 20px/medium (Header3/med) по узлу 2030:58391 — тот же
              размер, что уже используется в заголовках FriendsListView/NotificationsView. */}
          <h1 className="text-[20px] font-medium leading-6 text-[var(--mappy-text-primary)]">Запросы</h1>
        </div>
        <div className="px-2 pb-2">
          <RequestsTabControl
            outgoingCount={outgoing.length}
            incomingCount={incoming.length}
            active={activeTab}
            onChange={(tab) => {
              userPickedTab.current = true;
              setActiveTab(tab);
            }}
          />
        </div>
      </div>
    </div>
  );
}

// Сегментный переключатель по макету VisitStatusControl (844:14064) — обычно
// используется для статуса места, здесь переиспользован для вкладок запросов.
function RequestsTabControl({
  outgoingCount,
  incomingCount,
  active,
  onChange,
}: {
  outgoingCount: number;
  incomingCount: number;
  active: "outgoing" | "incoming";
  onChange: (tab: "outgoing" | "incoming") => void;
}) {
  return (
    <div className="flex h-11 w-full items-center gap-1 rounded-[28px] bg-[var(--mappy-surface-secondary)] p-1">
      <RequestsTab label="Отправленные" count={outgoingCount} isActive={active === "outgoing"} onClick={() => onChange("outgoing")} />
      <RequestsTab label="Полученные" count={incomingCount} isActive={active === "incoming"} onClick={() => onChange("incoming")} />
    </div>
  );
}

function RequestsTab({
  label,
  count,
  isActive,
  onClick,
}: {
  label: string;
  count: number;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full flex-1 items-center justify-center gap-1 rounded-[28px] px-6 text-[14px] font-medium tracking-[-0.6px]"
      style={{ backgroundColor: isActive ? "var(--mappy-surface-canvas)" : "transparent" }}
    >
      <span style={{ color: isActive ? "var(--mappy-text-primary)" : "var(--mappy-text-secondary)" }}>{label}</span>
      <span style={{ color: "#99a1af" }}>{count}</span>
    </button>
  );
}

function FriendProfileView({
  person: initialPerson,
  onBack,
  onOpenPlace,
  onChanged,
}: {
  person: ApiFriendProfile;
  onBack: () => void;
  onOpenPlace: (place: Place) => void;
  onChanged: (person: ApiFriendProfile, destination?: "profile" | "home") => Promise<void>;
}) {
  const [person, setPerson] = useState(initialPerson);
  const [places, setPlaces] = useState<Place[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showMenu, setShowMenu] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [filters, setFilters] = useState<PlaceFilters>(emptyFilters());
  const [showFilters, setShowFilters] = useState(false);
  // Прокручен ли список мест друга. Включает тень под строкой поиска и блюр,
  // под которым уезжает шапка профиля (макеты 2147:8095 → 2147:8263).
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    setPerson(initialPerson);
  }, [initialPerson]);

  useEffect(() => {
    if (person.relation !== "friend") {
      setPlaces([]);
      return;
    }
    let active = true;
    fetchFriendPlaces(person.id)
      .then((items) => {
        if (active) setPlaces(items);
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Не удалось загрузить места друга");
      });
    return () => {
      active = false;
    };
  }, [person.id, person.relation]);

  const visiblePlaces = useMemo(() => {
    const value = query.trim().toLowerCase();
    return places.filter((place) => {
      if (value && !place.title.toLowerCase().includes(value) && !place.address.toLowerCase().includes(value)) {
        return false;
      }
      return placeMatchesFilters(place, filters);
    });
  }, [places, query, filters]);

  const act = async (action: () => Promise<ApiFriendProfile | void>, destination: "profile" | "home" = "profile") => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const updated = await action();
      if (updated) {
        setPerson(updated);
        await onChanged(updated, destination);
      } else {
        await onChanged({ ...person, relation: "none", requestId: null }, destination);
      }
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Не удалось выполнить действие");
    } finally {
      setBusy(false);
    }
  };

  const friend = toFriend(person);

  return (
    <div
      className="relative h-full overflow-y-auto bg-[var(--mappy-surface-primary)] pb-32"
      onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 8)}
    >
      <ScreenBackButton onClick={onBack} />

      {/*
        Блюр верхнего края, под который уходят карточки мест. Держится наверху
        через sticky, а не absolute: absolute внутри скролл-контейнера уехал бы
        вместе с содержимым. Обёртка нулевой высоты, поэтому в потоке места не
        занимает и не сдвигает шапку профиля, а сам блюр позиционируется от неё.
        Высота 138px — из макета 2147:8263 (там же полоса поиска на 74px), это
        чуть больше общего `.blur-edge-top`, чтобы полоса не выступала из-под края.
      */}
      {person.relation === "friend" && (
        <div className="sticky top-0 z-10 h-0">
          <div
            className={`blur-edge-top transition-opacity duration-200 ${scrolled ? "opacity-100" : "opacity-0"}`}
            style={{ height: 138 }}
          />
        </div>
      )}

      {person.relation === "friend" && (
        <div className="absolute right-4 top-[calc(env(safe-area-inset-top)+20px)] z-20">
          <button
            type="button"
            aria-label="Действия с другом"
            className="flex h-7 w-7 items-center justify-center p-0"
            onClick={() => setShowMenu((value) => !value)}
          >
            <img src={dotsHorizontalIcon} alt="" className="h-1 w-[18px]" />
          </button>
          {showMenu && (
            <button
              type="button"
              onClick={() => {
                setShowMenu(false);
                setConfirmRemove(true);
              }}
              className="absolute right-0 top-10 w-[190px] rounded-[16px] bg-white px-4 py-3 text-left text-[15px] font-medium text-[#fb2c36] shadow-[0_12px_40px_rgba(30,41,57,0.14)]"
            >
              Удалить из друзей
            </button>
          )}
        </div>
      )}

      <div className="flex flex-col items-center px-4 pt-[calc(env(safe-area-inset-top)+41px)]">
        <ProfileAvatar person={person} />
        <div className="mt-[11px] text-center">
          <h1 className="text-[28px] font-semibold leading-8 text-black">{displayName(person)}</h1>
          {person.username && <p className="mt-3 text-[16px] leading-5 text-[var(--mappy-text-secondary)]">@{person.username}</p>}
        </div>

        <div className="mt-8 w-full">
          {person.relation === "none" && (
            <BrandActionButton
              disabled={busy || !person.username}
              onClick={() => void act(async () => {
                const sent = await sendFriendRequest(person.username ?? "");
                return sent;
              })}
            >
              {busy ? "Отправляем…" : "Подружиться"}
            </BrandActionButton>
          )}

          {person.relation === "outgoing" && (
            <div className="flex flex-col gap-2">
              <BrandActionButton disabled>Запрос отправлен!</BrandActionButton>
              {person.requestId && (
                <NeutralActionButton
                  disabled={busy}
                  onClick={() => void act(async () => {
                    await cancelFriendRequest(person.requestId!);
                  })}
                >
                  Отменить запрос
                </NeutralActionButton>
              )}
            </div>
          )}

          {person.relation === "incoming" && person.requestId && (
            <div className="flex flex-col gap-2">
              <CtaButton
                disabled={busy}
                onClick={() => void act(() => acceptFriendRequest(person.requestId!))}
              >
                {busy ? "Принимаем…" : "Принять"}
              </CtaButton>
              <NeutralActionButton
                disabled={busy}
                onClick={() => void act(async () => {
                  await cancelFriendRequest(person.requestId!);
                }, "home")}
              >
                Отклонить
              </NeutralActionButton>
            </div>
          )}

          {person.relation === "friend" && (
            <div className="flex flex-col gap-4">
              {/*
                Поиск прилипает к 74px от верха экрана (макет 2147:8263), пока
                шапка профиля уезжает вверх. Отсчёт от `--mappy-floating-top`, а
                не жёсткие 74px: на устройстве с вырезом это даёт ровно макетные
                74px, а без выреза строка не улетает под системную панель.
              */}
              <div className="sticky z-20" style={{ top: "calc(var(--mappy-floating-top) + 15px)" }}>
                <FriendPlacesSearchBar
                  value={query}
                  onChange={setQuery}
                  hasActiveFilters={!filtersAreEmpty(filters)}
                  onFilterTap={() => setShowFilters(true)}
                  elevated={scrolled}
                />
              </div>
              <div className="flex flex-col gap-3">
                {visiblePlaces.map((place) => {
                  const ownedPlace = { ...place, owner: friend };
                  return (
                    <PlaceRowCard
                      key={place.id}
                      place={ownedPlace}
                      showOwnerAvatar={false}
                      elevated={false}
                      onClick={() => onOpenPlace(ownedPlace)}
                    />
                  );
                })}
                {visiblePlaces.length === 0 && (
                  <div className="rounded-[16px] bg-white px-5 py-8 text-center text-[14px] text-[#99a1af]">
                    {places.length === 0 ? "У друга пока нет публичных мест" : "Ничего не найдено"}
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <p className="mt-3 text-center text-[13px] text-[#fb2c36]">{error}</p>}
        </div>
      </div>

      {confirmRemove && (
        <div className="account-confirm-backdrop" onClick={() => setConfirmRemove(false)}>
          <div className="account-confirm-sheet account-confirm-sheet-delete" onClick={(event) => event.stopPropagation()}>
            <div>
              <div className="account-confirm-grabber" />
              <div className="account-confirm-copy">
                <div className="account-confirm-heading">
                  <h2>Удалить из друзей?</h2>
                  <button type="button" onClick={() => setConfirmRemove(false)} aria-label="Закрыть">
                    <CloseIcon />
                  </button>
                </div>
                <p>Вы перестанете видеть публичные места друг друга. Вернуть дружбу можно будет новым запросом.</p>
              </div>
            </div>
            <div className="account-confirm-actions">
              <button
                type="button"
                className="account-confirm-primary"
                disabled={busy}
                onClick={() => void act(async () => {
                  await removeFriend(person.id);
                }, "home")}
              >
                {busy ? "Удаляем…" : "Удалить"}
              </button>
              <button type="button" className="account-confirm-secondary" onClick={() => setConfirmRemove(false)}>
                Оставить в друзьях
              </button>
            </div>
          </div>
        </div>
      )}

      {showFilters && (
        <FilterSheet
          filters={filters}
          places={places}
          showFriendPlacesToggle={false}
          onApply={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}
    </div>
  );
}

function FriendPlacesSearchBar({
  value,
  onChange,
  hasActiveFilters,
  onFilterTap,
  elevated = false,
}: {
  value: string;
  onChange: (value: string) => void;
  hasActiveFilters: boolean;
  onFilterTap: () => void;
  /** Строка прилипла к верху и висит над списком — тогда под ней нужна тень. */
  elevated?: boolean;
}) {
  return (
    <div
      className={`flex h-16 w-full items-center gap-1 rounded-[32px] bg-white p-2 transition-shadow duration-200 ${
        elevated ? "shadow-[0_8px_24px_rgba(30,41,57,0.10)]" : ""
      }`}
    >
      <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-l-[32px] rounded-r-[10px] bg-[var(--mappy-surface-secondary)] px-4 py-3">
        <SearchIcon
          className="h-6 w-6 shrink-0"
          color={value ? "var(--mappy-text-primary)" : "var(--mappy-text-tertiary)"}
        />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Поиск по адресу, названию"
          className="min-w-0 flex-1 bg-transparent text-[16px] font-medium leading-[18px] tracking-[-0.6px] text-[var(--mappy-text-primary)] outline-none placeholder:text-[var(--mappy-text-tertiary)]"
        />
      </label>
      <button
        type="button"
        onClick={onFilterTap}
        aria-label="Фильтры мест"
        aria-pressed={hasActiveFilters}
        className="relative flex h-12 shrink-0 items-center justify-center rounded-l-[10px] rounded-r-[32px] px-4"
        style={{ backgroundColor: hasActiveFilters ? "var(--mappy-brand-subtle)" : "rgba(3,7,18,0.04)" }}
      >
        <img src={filterIcon} alt="" className="h-6 w-6" />
        {hasActiveFilters && (
          <span className="absolute right-2.5 top-1.5 h-2 w-2 rounded-full bg-[var(--mappy-pink)]" />
        )}
      </button>
    </div>
  );
}

function PersonRow({
  person,
  border,
  suffix,
  onClick,
  padded = true,
}: {
  person: ApiFriendProfile;
  border?: boolean;
  suffix?: ReactNode;
  onClick: () => void;
  /* false — когда строка уже сидит в своей карточке (макет 2030:58119, p-4
     16px на карточке): свой py-3 поверх неё даёт лишние 12px и высоту 96px
     вместо 72px. true (по умолчанию) — для строк внутри общей белой секции. */
  padded?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 text-left ${padded ? "py-3" : ""}`}
      style={{ borderTop: border ? "1px solid var(--mappy-divider)" : "none" }}
    >
      <SmallAvatar person={person} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-[16px] font-semibold leading-[18px] text-[var(--mappy-text-primary)]">{displayName(person)}</p>
        {person.username && <p className="truncate text-[13px] leading-4 text-[var(--mappy-text-secondary)]">@{person.username}</p>}
      </div>
      {suffix}
    </button>
  );
}

function RelationLabel({ relation }: { relation: ApiFriendProfile["relation"] }) {
  const labels = { none: "", friend: "В друзьях", incoming: "Входящий", outgoing: "Отправлен" };
  if (relation === "none") return <span className="text-[20px] text-[var(--mappy-pink)]">＋</span>;
  return <span className="text-[12px] text-[#99a1af]">{labels[relation]}</span>;
}

function ProfileHeader({ user, onOpenAccount }: { user: ApiUser; onOpenAccount: () => void }) {
  const person = {
    id: user.id,
    name: user.name,
    username: user.username,
    avatarUrl: user.avatarUrl,
    relation: "none" as const,
  };
  return (
    <button type="button" onClick={onOpenAccount} className="relative mt-4 w-full rounded-[28px] bg-white px-6 py-4 text-left">
      <div className="relative flex items-center justify-between">
        <div className="max-w-[70%]">
          <p className="truncate text-[24px] font-semibold leading-7 text-[var(--mappy-text-primary)]">{displayName(person)}</p>
          {user.username && <p className="mt-2 text-[16px] text-[var(--mappy-text-secondary)]">@{user.username}</p>}
        </div>
        <div className="relative shrink-0">
          <SmallAvatar person={person} size={74} />
          <span className="absolute -right-1 -top-1 flex h-[30px] w-[30px] items-center justify-center rounded-full border-[3px] border-white bg-[#e5e7eb]">
            <SettingsGearIcon />
          </span>
        </div>
      </div>
    </button>
  );
}

/* Фото друга «приколото» булавкой к карточке, по макету 1918:21329. */
function ProfileAvatar({ person }: { person: ApiFriendProfile }) {
  const initials = avatarInitials(displayName(person));
  return (
    <div className="relative flex items-center justify-center" style={{ width: 163, height: 163 }}>
      <div style={{ transform: "rotate(-6.28deg)" }}>
        <div
          className="relative rounded-[20px]"
          style={{ width: 148, height: 148, border: "4px solid #f9fafb", boxShadow: "8px 2px 30px #e9e9e9" }}
        >
          <span
            className="flex h-full w-full items-center justify-center overflow-hidden rounded-[16px] font-semibold text-white"
            style={{
              fontSize: 41,
              background: person.avatarUrl ? "#e5e7eb" : avatarGradient(person.id),
            }}
          >
            {person.avatarUrl ? <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" /> : initials}
          </span>
          <div className="absolute" style={{ left: 95, top: -24, width: 66, height: 71, transform: "rotate(6.28deg)" }}>
            <img src={friendPhotoPin} alt="" className="h-full w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

export function SmallAvatar({ person, size = 40 }: { person: Pick<ApiFriendProfile, "id" | "name" | "username" | "avatarUrl">; size?: number }) {
  return <FriendAvatar person={person} size={size} />;
}

export function ScreenBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute left-4 top-[calc(env(safe-area-inset-top)+20px)] z-20 inline-flex items-center gap-1 text-[16px] font-medium text-[#99a1af]"
    >
      <BackIcon /> Назад
    </button>
  );
}

function BrandActionButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-full items-center justify-center rounded-[14px] bg-[#ff637e] text-[16px] font-medium text-white"
    >
      {children}
    </button>
  );
}

function NeutralActionButton({
  children,
  onClick,
  disabled,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-14 w-full items-center justify-center rounded-[14px] bg-[var(--mappy-surface-secondary)] text-[16px] font-medium text-[var(--mappy-text-secondary)] disabled:opacity-70"
    >
      {children}
    </button>
  );
}

function EmptyLine({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-[14px] text-[#99a1af]">{children}</p>;
}

export function BackIcon() {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* Зеркало BackIcon — для «Запросы ›» в шапке FriendsListView (макет 2264:9330, M/chevron-right). */
function ChevronRightIcon() {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M7.5 4.5L13 10l-5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

/* Значок настроек поверх аватара — по макету 1821:34749 (Correct Button / settings-02) */
function SettingsGearIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4A5565" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function CloseIcon() {
  return <svg viewBox="0 0 20 20" fill="none"><path d="M14.5 5.5l-9 9m0-9l9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}
