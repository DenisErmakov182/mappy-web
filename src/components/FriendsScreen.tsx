import { forwardRef, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  removeFriend,
  searchFriends,
  sendFriendRequest,
  type ApiFriend,
  type ApiFriendProfile,
  type ApiUser,
} from "../lib/api";
import { CtaButton } from "./primitives";
import { PlaceRowCard } from "./PlaceRowCard";
import friendsEmptyIllustration from "../assets/illustrations/friends-empty.webp";
import pinMap from "../assets/illustrations/pin-map.webp";
import searchIcon from "../assets/icons/search-icon.svg";
import filterIcon from "../assets/icons/filter-icon.svg";
import dotsHorizontalIcon from "../assets/icons/dots-horizontal.svg";
import { AccountScreen } from "./AccountScreen";
import { FilterSheet } from "./FilterSheet";

type FriendsView =
  | { kind: "home" }
  | { kind: "requests" }
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
}: {
  user: ApiUser;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
  onUserUpdated: (user: ApiUser) => void;
  onOpenPlace: (place: Place) => void;
  onFriendsChanged?: () => void;
}) {
  const [view, setView] = useState<FriendsView>({ kind: "home" });
  const [friends, setFriends] = useState<ApiFriendProfile[]>([]);
  const [incoming, setIncoming] = useState<ApiFriendProfile[]>([]);
  const [outgoing, setOutgoing] = useState<ApiFriendProfile[]>([]);
  const [showAccount, setShowAccount] = useState(false);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<ApiFriendProfile[]>([]);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    void loadRelationships();
  }, []);

  useEffect(() => {
    if (view.kind !== "home") return;
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
  }, [query, view.kind]);

  const openProfile = (person: ApiFriendProfile) => {
    setError("");
    setView({ kind: "profile", person });
  };

  const returnHome = () => {
    setError("");
    setView({ kind: "home" });
  };

  if (view.kind === "requests") {
    return (
      <RequestsView
        incoming={incoming}
        outgoing={outgoing}
        onBack={returnHome}
        onOpenProfile={openProfile}
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

  const hasSearch = Boolean(query.trim());

  return (
    <div className="h-full overflow-y-auto pb-32" style={{ backgroundColor: "var(--mappy-surface-primary)" }}>
      <div className="flex flex-col gap-2 px-4 pt-[var(--mappy-floating-top)]">
        <ProfileHeader user={user} onOpenAccount={() => setShowAccount(true)} />

        <section className="rounded-[16px] bg-white p-4">
          <SearchField ref={searchRef} value={query} onChange={setQuery} placeholder="Найти друга" />

          {hasSearch ? (
            <div className="mt-4">
              {searching && <EmptyLine>Ищем…</EmptyLine>}
              {!searching && searchResults.length === 0 && <EmptyLine>Никого не нашли</EmptyLine>}
              {!searching && searchResults.map((person, index) => (
                <PersonRow
                  key={person.id}
                  person={person}
                  border={index > 0}
                  suffix={<RelationLabel relation={person.relation} />}
                  onClick={() => openProfile(person)}
                />
              ))}
            </div>
          ) : friends.length === 0 && !loading ? (
            <div className="pt-5 text-center">
              <p className="text-[20px] font-semibold leading-6" style={{ color: "var(--mappy-text-primary)" }}>
                Вы еще не добавили друзей
              </p>
              <p className="mt-1 text-[14px] leading-5" style={{ color: "var(--mappy-text-secondary)" }}>
                Добавьте друзей — и находите
                <br />
                проверенные места
              </p>
              <img src={friendsEmptyIllustration} alt="" className="mx-auto mb-5 mt-2 w-[215px]" />
              {(incoming.length > 0 || outgoing.length > 0) && (
                <button
                  type="button"
                  onClick={() => setView({ kind: "requests" })}
                  className="mb-2 flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[#f3f4f6] text-[16px] font-medium text-[var(--mappy-text-primary)]"
                >
                  Запросы
                  {incoming.length > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--mappy-pink)] px-1.5 text-[12px] leading-5 text-white">
                      {incoming.length}
                    </span>
                  )}
                </button>
              )}
              <CtaButton onClick={() => searchRef.current?.focus()}>Найти друга</CtaButton>
            </div>
          ) : (
            <>
              {friends[0] && (
                <div className="mt-4 flex items-center justify-between rounded-[16px] bg-[#f3f4f6] p-4">
                  <div>
                    <p className="mb-1 text-[12px]" style={{ color: "var(--mappy-text-secondary)" }}>
                      Главный исследователь недели
                    </p>
                    <div className="flex items-center gap-2">
                      <span className="text-[18px] font-semibold" style={{ color: "var(--mappy-text-primary)" }}>
                        {friends[0].username || displayName(friends[0])}
                      </span>
                      <span className="rounded-full bg-[var(--mappy-brand-subtle)] px-2 py-1 text-[12px] font-medium text-[var(--mappy-pink)]">
                        +2 новых места! ↗
                      </span>
                    </div>
                  </div>
                  <img src={pinMap} alt="" className="w-9" />
                </div>
              )}

              <div className="mb-3 mt-4 flex items-center justify-between px-1">
                <span className="text-[15px]" style={{ color: "var(--mappy-text-secondary)" }}>
                  {friends.length} {friendCountLabel(friends.length)}
                </span>
                <button
                  type="button"
                  onClick={() => setView({ kind: "requests" })}
                  className="inline-flex items-center gap-1 text-[15px] font-medium text-[var(--mappy-pink)]"
                >
                  Запросы
                  {incoming.length > 0 && (
                    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--mappy-pink)] px-1.5 text-[12px] leading-5 text-white">
                      {incoming.length}
                    </span>
                  )}
                </button>
              </div>

              {friends.map((friend, index) => (
                <PersonRow
                  key={friend.id}
                  person={friend}
                  border={index > 0}
                  onClick={() => openProfile(friend)}
                />
              ))}
            </>
          )}

          {error && <p className="mt-3 px-1 text-center text-[13px] text-[#fb2c36]">{error}</p>}
        </section>
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
  const total = incoming.length + outgoing.length;
  return (
    <div className="relative h-full overflow-y-auto bg-[var(--mappy-surface-primary)] pb-32">
      <ScreenBackButton onClick={onBack} />
      <h1 className="pt-[calc(env(safe-area-inset-top)+50px)] text-center text-[24px] font-semibold leading-7 text-[var(--mappy-text-primary)]">
        Запросы
      </h1>

      <div className="px-4 pt-6">
        {total === 0 ? (
          <div className="rounded-[16px] bg-white px-6 py-8 text-center">
            <p className="text-[20px] font-semibold text-[var(--mappy-text-primary)]">Запросов нет</p>
            <p className="mt-2 text-[14px] text-[var(--mappy-text-secondary)]">
              Вероятно, вы уже со всеми подружились!
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {incoming.length > 0 && (
              <RequestSection title={`${incoming.length} ${requestCountLabel(incoming.length)}`}>
                {incoming.map((person, index) => (
                  <PersonRow key={person.id} person={person} border={index > 0} onClick={() => onOpenProfile(person)} />
                ))}
              </RequestSection>
            )}
            {outgoing.length > 0 && (
              <RequestSection title="Отправленные">
                {outgoing.map((person, index) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    border={index > 0}
                    suffix={<span className="text-[12px] text-[#99a1af]">Отправлен</span>}
                    onClick={() => onOpenProfile(person)}
                  />
                ))}
              </RequestSection>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function RequestSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[16px] bg-white p-4">
      <h2 className="mb-3 px-1 text-[16px] font-medium text-[var(--mappy-text-secondary)]">{title}</h2>
      {children}
    </section>
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
    <div className="relative h-full overflow-y-auto bg-[var(--mappy-surface-primary)] pb-32">
      <ScreenBackButton onClick={onBack} />

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
        <div className="mt-7 text-center">
          <h1 className="text-[28px] font-semibold leading-8 text-black">{displayName(person)}</h1>
          {person.username && <p className="mt-3 text-[16px] leading-5 text-[var(--mappy-text-secondary)]">@{person.username}</p>}
        </div>

        <div className="mt-8 w-full">
          {person.relation === "none" && (
            <NeutralActionButton
              disabled={busy || !person.username}
              onClick={() => void act(async () => {
                const sent = await sendFriendRequest(person.username ?? "");
                return sent;
              })}
            >
              {busy ? "Отправляем…" : "Подружиться"}
            </NeutralActionButton>
          )}

          {person.relation === "outgoing" && (
            <div className="flex flex-col gap-2">
              <NeutralActionButton disabled>Запрос отправлен!</NeutralActionButton>
              {person.requestId && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(async () => {
                    await cancelFriendRequest(person.requestId!);
                  })}
                  className="h-10 text-[14px] font-medium text-[#99a1af]"
                >
                  Отменить запрос
                </button>
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
              <FriendPlacesSearchBar
                value={query}
                onChange={setQuery}
                hasActiveFilters={!filtersAreEmpty(filters)}
                onFilterTap={() => setShowFilters(true)}
              />
              <div className="flex flex-col gap-3">
                {visiblePlaces.map((place) => {
                  const ownedPlace = { ...place, owner: friend };
                  return (
                    <PlaceRowCard
                      key={place.id}
                      place={ownedPlace}
                      showOwnerAvatar={false}
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
}: {
  value: string;
  onChange: (value: string) => void;
  hasActiveFilters: boolean;
  onFilterTap: () => void;
}) {
  return (
    <div className="flex h-16 w-full items-center gap-1 rounded-[32px] bg-white p-2">
      <label className="flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-l-[32px] rounded-r-[10px] bg-[var(--mappy-surface-secondary)] px-4 py-3">
        <img src={searchIcon} alt="" className="h-6 w-6 shrink-0" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Поиск по адресу, названию"
          className="min-w-0 flex-1 bg-transparent text-[16px] font-medium leading-[18px] tracking-[-0.6px] text-[var(--mappy-text-primary)] outline-none placeholder:text-[var(--mappy-text-secondary)]"
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

const SearchField = forwardRef<HTMLInputElement, {
    value: string;
    onChange: (value: string) => void;
    placeholder: string;
  }>(function SearchField({ value, onChange, placeholder }, ref) {
  return (
    <label className="flex h-12 items-center gap-2.5 rounded-[10px] bg-[#e5e7eb] px-4">
      <img src={searchIcon} alt="" className="h-5 w-5 shrink-0 opacity-70" />
      <input
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[16px] text-[var(--mappy-text-primary)] outline-none placeholder:text-[#6b7280]"
      />
    </label>
  );
});

function PersonRow({
  person,
  border,
  suffix,
  onClick,
}: {
  person: ApiFriendProfile;
  border?: boolean;
  suffix?: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 py-3 text-left"
      style={{ borderTop: border ? "1px solid var(--mappy-divider)" : "none" }}
    >
      <SmallAvatar person={person} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-semibold text-[var(--mappy-text-primary)]">{displayName(person)}</p>
        {person.username && <p className="truncate text-[13px] text-[var(--mappy-text-secondary)]">@{person.username}</p>}
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
    <button type="button" onClick={onOpenAccount} className="relative w-full rounded-[16px] bg-white px-6 pb-5 pt-6 text-left">
      <span className="absolute -top-2.5 left-6 rounded-full border border-[var(--mappy-pink)] bg-white px-2.5 py-1 text-[12px] font-medium text-[var(--mappy-pink)]">
        Базовый тариф
      </span>
      <div className="flex items-start justify-between">
        <div className="min-w-0 pr-3">
          <p className="truncate text-[24px] font-semibold leading-7 text-[var(--mappy-text-primary)]">{displayName(person)}</p>
          {user.username && <p className="mt-1.5 text-[14px] text-[var(--mappy-text-secondary)]">@{user.username}</p>}
        </div>
        <div className="relative shrink-0">
          <SmallAvatar person={person} size={74} />
          <span className="absolute -right-1 -top-1 flex h-[30px] w-[30px] items-center justify-center rounded-full bg-white shadow">
            <ArrowIcon />
          </span>
        </div>
      </div>
    </button>
  );
}

function ProfileAvatar({ person }: { person: ApiFriendProfile }) {
  return <SmallAvatar person={person} size={148} />;
}

function SmallAvatar({ person, size = 40 }: { person: Pick<ApiFriendProfile, "name" | "username" | "avatarUrl">; size?: number }) {
  const name = displayName(person as ApiFriendProfile);
  const initials = name.split(" ").map((word) => word[0]).slice(0, 2).join("").toUpperCase();
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(14, Math.round(size * 0.28)),
        background: person.avatarUrl ? "#e5e7eb" : "linear-gradient(135deg, #99a1af, #4a5565)",
      }}
    >
      {person.avatarUrl ? <img src={person.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" /> : initials}
    </span>
  );
}

function ScreenBackButton({ onClick }: { onClick: () => void }) {
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

function friendCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "друг";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "друга";
  return "друзей";
}

function requestCountLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "запрос";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "запроса";
  return "запросов";
}

function BackIcon() {
  return <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M12.5 4.5L7 10l5.5 5.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function ArrowIcon() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="#4A5565" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

function CloseIcon() {
  return <svg viewBox="0 0 20 20" fill="none"><path d="M14.5 5.5l-9 9m0-9l9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}
