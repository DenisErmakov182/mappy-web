import { useCallback, useEffect, useMemo, useState } from "react";
import { TabBar, type AppTab } from "./components/TabBar";
import { SearchFilterBar } from "./components/SearchFilterBar";
import { FilterSheet } from "./components/FilterSheet";
import { MapView } from "./components/MapView";
import { CenterPin } from "./components/CenterPin";
import { MapAddressChip } from "./components/MapAddressChip";
import { AddPlaceSheet } from "./components/AddPlaceSheet";
import { PlaceDetail } from "./components/PlaceDetail";
import { PlaceCardCarousel } from "./components/PlaceCardCarousel";
import { NotesList } from "./components/NotesList";
import { FoldersGrid } from "./components/FoldersGrid";
import { FolderSearchBar } from "./components/FolderSearchBar";
import { FolderDetailScreen } from "./components/FolderDetailScreen";
import { FolderNameSheet } from "./components/FolderNameSheet";
import { FriendsScreen } from "./components/FriendsScreen";
import { SearchOverlay } from "./components/SearchOverlay";
import { AuthScreen } from "./components/AuthScreen";
import { LegalScreen } from "./components/LegalScreen";
import {
  LEGAL_DOCUMENTS,
  readLegalDocument,
  type LegalDocument,
  type LegalDocumentId,
} from "./legal/documents";
import { SharedPlaceScreen } from "./components/SharedPlaceScreen";
import { OnboardingScreen, hasSeenOnboarding } from "./components/OnboardingScreen";
import { LocationPermissionScreen } from "./components/LocationPermissionScreen";
import { CloseButton } from "./components/primitives";
import { PwaUpdateBanner } from "./components/PwaUpdateBanner";
import { distanceMeters, forgetLocation, getLastKnownLocation, rememberLocation } from "./lib/geo";
import locateMeIcon from "./assets/icons/locate-me-3d.webp";
import {
  hasPwaUpdate,
  subscribeToPwaUpdate,
} from "./lib/pwaUpdate";
import {
  getToken,
  setToken as persistToken,
  clearToken,
  getSessionUser,
  persistUser,
  isAuthenticationError,
  getMe,
  fetchPlaces,
  fetchFriends,
  fetchFriendPlaces,
  reverseGeocode,
  createPlace,
  updatePlace,
  deletePlace,
  deleteAccount,
  createPlaceShare,
  fetchFolders,
  createFolder,
  type ApiUser,
  type ApiFriend,
  type PlaceInput,
  type Folder,
} from "./lib/api";
import {
  emptyFilters,
  filtersAreEmpty,
  placeMatchesFilters,
  type Place,
  type PlaceFilters,
  type Friend,
} from "./types";

const SHARE_PATH_PREFIX = "/s/";
const LOCATION_PROMPT_COMPLETED_KEY = "mappy_location_prompt_completed";
const MAP_WITHOUT_LOCATION = { center: { lat: 61.524, lng: 105.3188 }, zoom: 3 };

type MapLaunchState = {
  center: { lat: number; lng: number };
  zoom: number;
};

/*
 * Под-режимы вкладки «Сохранённое» — переключатель «Сохраненное/Папки» над
 * таббаром управляет list/folders, а folder (конкретная папка) — отдельное
 * состояние поверх folders, куда попадают тапом по карточке папки. Свой тип,
 * не булев флаг: третье состояние несёт id и название папки, которые иначе
 * пришлось бы держать отдельными полями и синхронизировать вручную.
 */
type SavedView = { kind: "list" } | { kind: "folders" } | { kind: "folder"; id: string; title: string };

function hasCompletedLocationPrompt(): boolean {
  try {
    return localStorage.getItem(LOCATION_PROMPT_COMPLETED_KEY) === "1";
  } catch {
    return false;
  }
}

function completeLocationPrompt() {
  try {
    localStorage.setItem(LOCATION_PROMPT_COMPLETED_KEY, "1");
  } catch {
    // localStorage недоступен — экран может появиться снова при следующем запуске
  }
}

function resetLocationPrompt() {
  forgetLocation();
  try {
    localStorage.removeItem(LOCATION_PROMPT_COMPLETED_KEY);
  } catch {
    // Состояние всё равно сбросится в памяти текущего запуска.
  }
}

/*
 * Роутера в проекте нет — путь публичной ссылки читаем сам, один раз при
 * запуске. Пустой хвост («/s» или «/s/») ссылкой не считаем, а любой другой
 * отдаём странице: разбираться, живой это токен или мусор, всё равно серверу,
 * и человеку из мессенджера полезнее «ссылка не работает», чем экран входа.
 */
function readShareToken(): string | null {
  const path = window.location.pathname;
  if (!path.startsWith(SHARE_PATH_PREFIX)) return null;
  const token = path.slice(SHARE_PATH_PREFIX.length).replace(/\/+$/, "");
  if (!token) return null;
  try {
    return decodeURIComponent(token);
  } catch {
    // Битая процентная кодировка («/s/%E0%A4%A») роняет decodeURIComponent.
    // Это адрес снаружи, прислать его может кто угодно, и падение здесь
    // случилось бы прямо в рендере — вместо места человек увидел бы экран
    // восстановления. Отдаём как есть: сервер всё равно ответит 404.
    return token;
  }
}

function toPlaceInput(place: Place): PlaceInput {
  return {
    title: place.title,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    rating: place.rating,
    categories: place.categories,
    note: place.note,
    isPrivate: place.isPrivate,
    status: place.status,
    photos: place.photos,
    systemName: place.systemName,
    folderIds: place.folderIds ?? [],
  };
}

function toFriend(friend: ApiFriend): Friend {
  return {
    id: friend.id,
    name: friend.name ?? friend.username ?? "Без имени",
    username: friend.username ?? "",
    avatarUrl: friend.avatarUrl ?? undefined,
  };
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<ApiUser | null>(() => {
    const storedToken = getToken();
    return storedToken ? getSessionUser(storedToken) : null;
  });
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding());
  const [shareToken, setShareToken] = useState<string | null>(readShareToken);
  // Документ читается из адреса при запуске (человек мог прийти по прямой
  // ссылке на /privacy) и открывается поверх экрана входа по тапу в чекбоксе.
  const [legalDocument, setLegalDocument] = useState<LegalDocument | null>(() =>
    readLegalDocument(window.location.pathname),
  );
  const [mapLaunch, setMapLaunch] = useState<MapLaunchState | null>(() => {
    const stored = getLastKnownLocation();
    if (stored) return { center: stored, zoom: 12 };
    return hasCompletedLocationPrompt() ? MAP_WITHOUT_LOCATION : null;
  });

  useEffect(() => {
    // Снимаем аварийный boot-watchdog только после первого настоящего React-рендера.
    window.__MAPPY_MARK_BOOTED__?.();
  }, []);

  useEffect(() => {
    if (!token) {
      return;
    }
    getMe()
      .then((u) => {
        persistUser(u);
        setUser(u);
      })
      .catch((error) => {
        // Только подтверждённо недействительная сессия означает выход.
        // Таймаут, VPN, offline и 5xx не должны выбрасывать пользователя
        // из приложения или превращать экран в пустой.
        if (isAuthenticationError(error)) {
          clearToken();
          setToken(null);
          setUser(null);
        }
      });
  }, [token]);

  const handleAuthenticated = (newToken: string, newUser: ApiUser, isNew: boolean) => {
    persistToken(newToken);
    persistUser(newUser);
    setToken(newToken);
    setUser(newUser);
    if (isNew) {
      // Новый аккаунт должен сам дать согласие на геолокацию, даже если
      // на этом устройстве раньше уже использовался другой аккаунт.
      resetLocationPrompt();
      setMapLaunch(null);
      setShowOnboarding(true);
    }
  };

  // Публичная ссылка на место открывается ДО проверки входа: получатель видит
  // место сразу, а регистрация начинается только по кнопке внизу страницы.
  const leaveSharePage = () => {
    // Адрес чистим только когда с публичной страницы уходят: пока она открыта,
    // перезагрузка должна показывать то же место.
    window.history.replaceState(null, "", "/");
    setShareToken(null);
  };

  const openLegalDocument = (id: LegalDocumentId) => {
    setLegalDocument(LEGAL_DOCUMENTS.find((document) => document.id === id) ?? null);
  };

  const closeLegalDocument = () => {
    // Адрес чистим только если человек пришёл по прямой ссылке на документ.
    // Когда документ открыт поверх экрана входа, в адресной строке всё это время
    // остаётся «/», и трогать историю незачем.
    if (readLegalDocument(window.location.pathname)) {
      window.history.replaceState(null, "", "/");
    }
    setLegalDocument(null);
  };

  if (shareToken) {
    return (
      <SharedPlaceScreen
        token={shareToken}
        signedIn={Boolean(token && user)}
        onAuthenticated={(newToken, newUser, isNew) => {
          handleAuthenticated(newToken, newUser, isNew);
          leaveSharePage();
        }}
        onOpenApp={leaveSharePage}
      />
    );
  }

  if (!token || !user) {
    // Документ идёт слоем поверх, а не вместо: иначе возврат из Политики стирал
    // бы уже введённую почту и отбрасывал человека в начало входа.
    return (
      <>
        <AuthScreen onAuthenticated={handleAuthenticated} onOpenLegal={openLegalDocument} />
        {legalDocument && (
          <LegalScreen document={legalDocument} onClose={closeLegalDocument} />
        )}
      </>
    );
  }

  // Сюда попадает уже вошедший человек, открывший /privacy или /terms по прямой
  // ссылке, — например из письма или закладки.
  if (legalDocument) {
    return <LegalScreen document={legalDocument} onClose={closeLegalDocument} />;
  }

  if (showOnboarding) {
    return <OnboardingScreen onDone={() => setShowOnboarding(false)} />;
  }

  if (!mapLaunch) {
    return (
      <LocationPermissionScreen
        onLocated={(coordinates) => {
          rememberLocation(coordinates.lat, coordinates.lng);
          completeLocationPrompt();
          setMapLaunch({ center: coordinates, zoom: 12 });
        }}
        onContinueWithoutLocation={() => {
          completeLocationPrompt();
          setMapLaunch(MAP_WITHOUT_LOCATION);
        }}
      />
    );
  }

  return (
    <MapApp
      user={user}
      initialCenter={mapLaunch.center}
      initialZoom={mapLaunch.zoom}
      onUserUpdated={(updatedUser) => {
        persistUser(updatedUser);
        setUser(updatedUser);
      }}
      onLogout={() => {
        clearToken();
        setToken(null);
        setUser(null);
      }}
      onDeleteAccount={async () => {
        await deleteAccount();
        clearToken();
        setToken(null);
        setUser(null);
      }}
    />
  );
}

function MapApp({
  user,
  initialCenter,
  initialZoom,
  onUserUpdated,
  onLogout,
  onDeleteAccount,
}: {
  user: ApiUser;
  initialCenter: { lat: number; lng: number };
  initialZoom: number;
  onUserUpdated: (user: ApiUser) => void;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
}) {
  const [tab, setTab] = useState<AppTab>("map");
  const [places, setPlaces] = useState<Place[]>([]);
  const [savedView, setSavedView] = useState<SavedView>({ kind: "list" });
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loadingFolders, setLoadingFolders] = useState(false);
  const [foldersError, setFoldersError] = useState(false);
  const [showCreateFolder, setShowCreateFolder] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [friendPlaces, setFriendPlaces] = useState<Place[]>([]);
  const [focusedFriendId, setFocusedFriendId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [folderQuery, setFolderQuery] = useState("");
  const [filters, setFilters] = useState<PlaceFilters>(emptyFilters());
  const [showFilters, setShowFilters] = useState(false);
  const [draftCoordinate, setDraftCoordinate] = useState<{ lat: number; lng: number } | null>(null);
  // Название из подсказки поиска («Магнит»), выбранной перед тапом по пину —
  // см. onSelectAddress ниже. Хранится вместе с координатой суффикса, чтобы
  // не подставить чужое имя, если между выбором и тапом центр карты сдвинулся
  // на что-то другое (см. проверку рядом с setDraftCoordinate).
  const [pendingPlaceName, setPendingPlaceName] = useState<{ lat: number; lng: number; name: string } | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedPlaces, setSelectedPlaces] = useState<Place[]>([]);
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const [center, setCenter] = useState(initialCenter);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [centerAddress, setCenterAddress] = useState("");
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; ts: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [placesError, setPlacesError] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);
  const [pwaUpdateAvailable, setPwaUpdateAvailable] = useState(hasPwaUpdate);
  const [friendsResetSignal, setFriendsResetSignal] = useState(0);
  const [shareNotice, setShareNotice] = useState("");

  useEffect(() => subscribeToPwaUpdate(setPwaUpdateAvailable), []);

  // Результат «Поделиться» иначе никак не виден: системный лист открывается сам,
  // а копирование в буфер и отказ сервера молча ничего не меняют на экране.
  useEffect(() => {
    if (!shareNotice) return;
    const timeout = setTimeout(() => setShareNotice(""), 4000);
    return () => clearTimeout(timeout);
  }, [shareNotice]);

  const loadPlaces = () => {
    setLoadingPlaces(true);
    setPlacesError(false);
    fetchPlaces()
      .then((data) => {
        setPlaces(data);
        setLoadingPlaces(false);
      })
      .catch(() => {
        setPlacesError(true);
        setLoadingPlaces(false);
      });
  };

  useEffect(() => {
    loadPlaces();
  }, []);

  const loadFolders = () => {
    setLoadingFolders(true);
    setFoldersError(false);
    fetchFolders()
      .then((data) => {
        setFolders(data);
        setLoadingFolders(false);
      })
      .catch(() => {
        setFoldersError(true);
        setLoadingFolders(false);
      });
  };

  useEffect(() => {
    loadFolders();
  }, []);

  // Новая папка создаётся и из грид-экрана «Папки» (эта функция), и из
  // FolderPickerSheet внутри формы места (там свой onCreateFolder, не
  // разделяем — контексты разные: тут сразу отмечать нечего). В обоих
  // случаях список папок в App.tsx должен узнать о новой папке, иначе
  // FoldersGrid не обновится без перезагрузки.
  const handleCreateFolder = async (title: string) => {
    setCreatingFolder(true);
    try {
      const folder = await createFolder(title);
      setFolders((prev) => [folder, ...prev]);
      setShowCreateFolder(false);
      return folder;
    } finally {
      setCreatingFolder(false);
    }
  };

  const refreshFriendPlaces = useCallback(async () => {
    try {
      const apiFriends = await fetchFriends();
      const friends = apiFriends.map(toFriend);
      const placeGroups = await Promise.all(
        friends.map(async (friend) => {
          try {
            const publicPlaces = await fetchFriendPlaces(friend.id);
            return publicPlaces.map((place) => ({ ...place, owner: friend }));
          } catch {
            // Ошибка одного друга не должна скрыть остальные места и свои точки.
            return [];
          }
        }),
      );
      setFriendPlaces(placeGroups.flat());
    } catch {
      // Карта со своими местами остаётся полностью рабочей и без списка друзей.
    }
  }, []);

  useEffect(() => {
    void refreshFriendPlaces();
  }, [refreshFriendPlaces]);

  const locateMe = (silent = false) => {
    if (!navigator.geolocation) return;
    if (!silent) setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        rememberLocation(lat, lng);
        setCenter({ lat, lng });
        // При автозапуске карта уже открыта примерно в нужном месте (сохранённые
        // координаты) — анимированный перелёт нужен только по ручному нажатию кнопки.
        if (!silent) setFlyTo({ lat, lng, ts: Date.now() });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  // Адрес под поиском для центрального пина (макет 1893:39146). Дебаунс сглаживает
  // серию быстрых flick-жестов в один запрос геокодера вместо запроса на каждый
  // moveend — 800мс, не 500: при активном облёте карты (особенно не-РФ точек,
  // которые всегда идут через общую очередь Nominatim с лимитом 1 запрос/сек)
  // более редкие запросы меньше забивают эту очередь.
  useEffect(() => {
    if (tab !== "map" || selectedPlaces.length > 0) return;
    let cancelled = false;
    const timeout = setTimeout(() => {
      reverseGeocode(center.lat, center.lng)
        .then((addr) => {
          if (!cancelled) setCenterAddress(addr);
        })
        .catch(() => {
          // Раньше молча оставляли прежний адрес при сбое геокодера — при
          // серии сбоев (например, очередь Nominatim не успевает за облётом
          // карты) плашка показывала неверный адрес точки, на которой давно
          // не стоим. Честнее погасить её, чем врать устаревшим значением.
          if (!cancelled) setCenterAddress("");
        });
    }, 800);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [center.lat, center.lng, tab, selectedPlaces.length]);

  const visiblePlaces = useMemo(() => {
    return places.filter((place) => {
      if (!placeMatchesFilters(place, filters)) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return place.title.toLowerCase().includes(q) || place.address.toLowerCase().includes(q);
    });
  }, [places, filters, query]);

  const mapPlaces = useMemo(() => {
    if (!filters.includeFriendPlaces) return visiblePlaces;
    const q = query.trim().toLowerCase();
    const visibleFriendPlaces = friendPlaces.filter((place) => {
      if (focusedFriendId && place.owner?.id !== focusedFriendId) return false;
      if (!placeMatchesFilters(place, filters)) return false;
      if (!q) return true;
      return place.title.toLowerCase().includes(q) || place.address.toLowerCase().includes(q);
    });
    return [...visiblePlaces, ...visibleFriendPlaces];
  }, [visiblePlaces, friendPlaces, focusedFriendId, filters, query]);

  const copyToClipboard = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setShareNotice("Ссылка скопирована");
    } catch {
      // Буфер обмена недоступен — показываем сам адрес, чтобы ссылку можно было
      // скопировать вручную, а не остаться без результата вообще.
      setShareNotice(url);
    }
  };

  const shareText = async (text: string, title: string) => {
    if (navigator.share) {
      try {
        await navigator.share({ title, text });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      setShareNotice("Скопировано");
    } catch {
      setShareNotice("Не удалось поделиться");
    }
  };

  /*
   * «Поделиться» отдаёт настоящую ссылку на место — публичную страницу
   * `/s/:token`, которая открывается без входа. Ссылку выдаёт сервер и
   * переиспользует уже существующую живую, поэтому повторные нажатия не плодят
   * новые адреса.
   *
   * Место друга расшарить нельзя: ссылку вправе выдать только владелец
   * (`POST /places/:id/share` проверяет user_id и отвечает 404 на чужое).
   * Для чужой карточки остаётся прежнее поведение — текст с названием и адресом.
   */
  const sharePlace = async (place: Place) => {
    if (place.owner) {
      await shareText(`${place.title}\n${place.address}`, place.title);
      return;
    }

    let url: string;
    try {
      const { token } = await createPlaceShare(place.id);
      // Домен берём текущий, а не зашитый: на стенде ссылка должна вести на
      // стенд, в проде — на app.mymappy.ru.
      url = `${window.location.origin}${SHARE_PATH_PREFIX}${token}`;
    } catch (error) {
      setShareNotice(error instanceof Error ? error.message : "Не удалось создать ссылку");
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({ title: place.title, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Системный лист мог не открыться (например, жест уже «остыл», пока
        // сервер выдавал ссылку) — тогда остаётся буфер обмена.
      }
    }
    await copyToClipboard(url);
  };

  // Глобальная верхняя зона (SearchFilterBar + блюр) — только там, где нет
  // собственной шапки: не на «Друзьях» и не внутри конкретной папки.
  // У сетки папок отдельный FolderSearchBar, но он тоже плавающий и занимает
  // ту же геометрию, что поиск «Сохранённого».
  const showGlobalTopBar = tab !== "friends" && !(tab === "notes" && savedView.kind !== "list");
  const showFoldersTopBar = tab === "notes" && savedView.kind === "folders";

  const shouldShowPwaUpdateBanner =
    pwaUpdateAvailable &&
    !showSearch &&
    !showFilters &&
    !draftCoordinate &&
    !detailPlace &&
    !editingPlace &&
    selectedPlaces.length === 0;

  return (
    <div className="app-shell bg-white">
      {/* Контент вкладок */}
      <div className="absolute inset-0">
        {tab === "map" && (
          <MapView
            places={mapPlaces}
            center={center}
            initialZoom={initialZoom}
            onCenterChange={setCenter}
            onSelectPlace={setSelectedPlaces}
            onMovingChange={setIsMapMoving}
            flyTo={flyTo}
          />
        )}
        {tab === "notes" && savedView.kind === "list" && (
          <NotesList
            places={mapPlaces}
            onSelectPlace={setDetailPlace}
            onGoToMap={() => setTab("map")}
            onEditPlace={(place) => setEditingPlace(place)}
            onDeletePlace={async (place) => {
              if (!window.confirm(`Удалить «${place.title}»?`)) return;
              await deletePlace(place.id);
              setPlaces((prev) => prev.filter((item) => item.id !== place.id));
              setSelectedPlaces((prev) => prev.filter((item) => item.id !== place.id));
            }}
            onSharePlace={sharePlace}
          />
        )}
        {tab === "notes" && savedView.kind === "folders" && (
          <FoldersGrid
            folders={folders}
            query={folderQuery}
            onOpenFolder={(folder) => setSavedView({ kind: "folder", id: folder.id, title: folder.title })}
            onCreateFolder={() => setShowCreateFolder(true)}
          />
        )}
        {tab === "notes" && savedView.kind === "folder" && (
          <FolderDetailScreen
            key={savedView.id}
            folderId={savedView.id}
            folderTitle={savedView.title}
            onBack={() => setSavedView({ kind: "folders" })}
            onSelectPlace={setDetailPlace}
            onEditPlace={(place) => setEditingPlace(place)}
            onSharePlace={sharePlace}
            onGoToMap={() => setTab("map")}
            onPlaceRemoved={() => loadFolders()}
            filters={filters}
            hasActiveFilters={!filtersAreEmpty(filters)}
            onFilterTap={() => setShowFilters(true)}
          />
        )}
        {tab === "friends" && (
          <FriendsScreen
            user={user}
            onUserUpdated={onUserUpdated}
            onLogout={onLogout}
            onDeleteAccount={onDeleteAccount}
            onOpenPlace={setDetailPlace}
            onFriendsChanged={() => void refreshFriendPlaces()}
            resetSignal={friendsResetSignal}
          />
        )}
      </div>

      {/* Блюр-градиенты сверху и снизу (по макету 1489:15421 — без белых подложек).
          «Папки» и экран внутри папки — тоже свой верх (грид без плавающей
          шапки, FolderDetailScreen — с собственной, рисует блюр сам, как
          FriendsListView), поэтому глобальный SearchFilterBar здесь лишний. */}
      {(showGlobalTopBar || showFoldersTopBar) && <div className="blur-edge-top" />}
      {!detailPlace && <div className="blur-edge-bottom" />}

      {/* Верхняя зона: поиск + фильтр (на карте и в «Сохранённом»-списке) */}
      {showGlobalTopBar && (
        <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-[var(--mappy-floating-top)]">
          <SearchFilterBar
            query={query}
            onOpenSearch={() => setShowSearch(true)}
            onClearQuery={() => setQuery("")}
            hasActiveFilters={!filtersAreEmpty(filters)}
            onFilterTap={() => setShowFilters(true)}
          />
        </div>
      )}

      {showFoldersTopBar && (
        <div className="absolute left-0 right-0 top-0 z-20 px-4 pt-[var(--mappy-floating-top)]">
          <FolderSearchBar query={folderQuery} onQueryChange={setFolderQuery} />
        </div>
      )}

      {/* Адрес центрального пина — появляется, когда карта остановилась (макет 1893:39146) */}
      {tab === "map" && selectedPlaces.length === 0 && centerAddress && (
        <div
          className={`pointer-events-none absolute left-1/2 z-20 w-max -translate-x-1/2 px-4 transition-opacity duration-200 ${
            isMapMoving ? "opacity-0" : "opacity-100"
          }`}
          style={{ top: "calc(var(--mappy-floating-top) + var(--mappy-search-bar-height) + 24px)" }}
        >
          <MapAddressChip address={centerAddress} />
        </div>
      )}

      {/* Баннер ошибки загрузки мест — данные не потеряны, просто не подгрузились */}
      {placesError && (
        <div className="absolute top-[var(--mappy-floating-top)] left-4 right-4 z-50 mt-14 flex items-center justify-between gap-3 rounded-2xl bg-[#1e2939] px-4 py-3 text-sm text-white">
          <span>Не удалось загрузить места</span>
          <button
            onClick={loadPlaces}
            disabled={loadingPlaces}
            className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 font-medium"
          >
            {loadingPlaces ? "Загрузка…" : "Повторить"}
          </button>
        </div>
      )}

      {/* Баннер ошибки загрузки папок — виден только там, где папки на экране */}
      {foldersError && tab === "notes" && savedView.kind !== "list" && (
        <div className="absolute top-[var(--mappy-floating-top)] left-4 right-4 z-50 mt-14 flex items-center justify-between gap-3 rounded-2xl bg-[#1e2939] px-4 py-3 text-sm text-white">
          <span>Не удалось загрузить папки</span>
          <button
            onClick={loadFolders}
            disabled={loadingFolders}
            className="shrink-0 rounded-full bg-white/15 px-3 py-1.5 font-medium"
          >
            {loadingFolders ? "Загрузка…" : "Повторить"}
          </button>
        </div>
      )}

      {/* Главный пин в центре карты — тап добавляет место в этой точке */}
      {tab === "map" && selectedPlaces.length === 0 && (
        <CenterPin
          isMoving={isMapMoving}
          onClick={() => {
            // Фиксируем координату один раз. Изменения размеров viewport при
            // открытии формы и клавиатуры больше не могут сдвинуть сохраняемую точку.
            setDraftCoordinate({ ...center });
          }}
        />
      )}

      {/* Кнопка «Где я»: перелёт к геолокации пользователя */}
      {tab === "map" && (
        <button
          onClick={() => locateMe()}
          className="absolute right-4 bottom-[110px] z-20 flex h-12 w-12 items-center justify-center rounded-full bg-white"
          aria-label="Моё местоположение"
        >
          <img
            src={locateMeIcon}
            alt=""
            className={`w-6 h-6 object-contain ${locating ? "animate-pulse" : ""}`}
          />
        </button>
      )}

      {/* Плавающая карточка выбранного места (или карусель, если мест в одной точке несколько) над таббаром */}
      {tab === "map" && selectedPlaces.length > 0 && (
        <div className="absolute left-0 right-0 bottom-[calc(var(--mappy-floating-bottom)+84px)] z-20">
          <div
            className={`mb-2 flex justify-end ${selectedPlaces.length === 1 ? "px-4" : "px-[7.5vw]"}`}
          >
            <CloseButton onClick={() => setSelectedPlaces([])} size={24} />
          </div>
          <PlaceCardCarousel
            places={selectedPlaces}
            onSelect={(place) => {
              setDetailPlace(place);
              setSelectedPlaces([]);
            }}
          />
        </div>
      )}

      {/* Единый баннер обновления из Figma 2097:821 на всех вкладках. */}
      {shouldShowPwaUpdateBanner && (
        <div className="absolute bottom-[calc(var(--mappy-floating-bottom)+96px)] left-4 right-4 z-30">
          <PwaUpdateBanner onDismiss={() => setPwaUpdateAvailable(false)} />
        </div>
      )}

      {/* Итог «Поделиться» — поверх карточки места, она сама fixed z-50 */}
      {shareNotice && (
        <div className="fixed bottom-[calc(var(--mappy-floating-bottom)+96px)] left-4 right-4 z-[60]">
          <button
            type="button"
            onClick={() => setShareNotice("")}
            className="w-full rounded-2xl bg-[#1e2939] px-4 py-3 text-left text-sm [overflow-wrap:anywhere] text-white"
          >
            {shareNotice}
          </button>
        </div>
      )}

      {/* Переключатель «Сохраненное/Папки» — узел 2289:42924, сидит НАД таббаром
          постоянно на вкладке «Сохранённое», во всех трёх под-режимах (включая
          список внутри конкретной папки — там он тоже виден, просто «Папки»
          остаётся выбранным). Тот же сегмент-контрол, что уже в AddPlaceSheet
          («Уже был»/«Планирую сходить»): bg-secondary p-1 rounded-28 h-11,
          белая заливка активного сегмента. Ширина/позиция — по метаданным узла:
          пилюля 332px в 399px зоне таббара (px-4 на 430px экране), гэп до
          таббара — 4px, не общий отступ 24px, как у прочих плавающих элементов. */}
      {tab === "notes" && (
        <div
          className="absolute left-0 right-0 z-20 px-4"
          style={{ bottom: "calc(var(--mappy-floating-bottom) + 64px)" }}
        >
          <div
            className="mx-auto flex h-11 items-center rounded-[28px] p-1"
            style={{ width: 332, backgroundColor: "var(--mappy-surface-secondary)" }}
          >
            {(
              [
                ["list", "Сохраненное"],
                ["folders", "Папки"],
              ] as [SavedView["kind"], string][]
            ).map(([kind, label]) => (
              <button
                key={kind}
                type="button"
                onClick={() => setSavedView(kind === "list" ? { kind: "list" } : { kind: "folders" })}
                className="flex h-full flex-1 items-center justify-center overflow-hidden rounded-[28px] px-6 text-[14px] leading-[18px] font-medium tracking-[-0.6px] transition-colors"
                style={{
                  backgroundColor: savedView.kind === kind || (kind === "folders" && savedView.kind === "folder") ? "#fff" : "transparent",
                  color:
                    savedView.kind === kind || (kind === "folders" && savedView.kind === "folder")
                      ? "var(--mappy-text-primary)"
                      : "var(--mappy-text-secondary)",
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Таббар */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-[var(--mappy-floating-bottom)]">
        <TabBar
          selection={tab}
          onSelect={(t) => {
            // Тап по уже активной вкладке возвращает её в корень — привычное
            // мобильное поведение. Для «Друзей» это ещё и единственный выход с
            // профиля друга, когда список его мест прокручен: «Назад» уезжает
            // вверх вместе с шапкой, а липкая строка поиска его не содержит.
            // Для «Сохранённого» — то же самое: если человек ушёл в «Папки»
            // или внутрь конкретной папки, повторный тап по «Сохранённое»
            // возвращает к списку, а не оставляет висеть в подрежиме.
            if (t === tab && t === "friends") {
              setFriendsResetSignal((value) => value + 1);
            }
            if (t === tab && t === "notes") {
              setSavedView({ kind: "list" });
            }
            setTab(t);
            setSelectedPlaces([]);
          }}
        />
      </div>

      {/* Оверлеи */}
      {showSearch && (
        <SearchOverlay
          places={places}
          initialQuery={query}
          origin={center}
          onSubmit={setQuery}
          onSelectPlace={(place) => {
            setCenter({ lat: place.latitude, lng: place.longitude });
            setSelectedPlaces([place]);
            setTab("map");
          }}
          onSelectAddress={(suggestion) => {
            // Не место, а точка на карте, которую ещё не занесли — перелетаем туда
            // и даём посмотреть на неё через центральный пин, как при обычном
            // позиционировании карты. Раньше карточка открывалась в тот же момент,
            // минуя этот шаг — геокодер не всегда точен, а человек так и не видел
            // пин до того, как место уже сохранялось в эту точку (решение
            // владельца 08.08.2026). Открытие формы — по тому же тапу на
            // центральный пин, что и у ручного позиционирования.
            //
            // setCenter один не двигает карту: MapView применяет проп `center`
            // только при монтировании, дальше камеру двигает только `flyTo`
            // (см. locateMe). Без этой строки адрес в плашке обновлялся бы
            // честно (эффект слушает center), а сам пин так и стоял бы на
            // месте — баг, пойманный владельцем в бою.
            setCenter({ lat: suggestion.lat, lng: suggestion.lng });
            setFlyTo({ lat: suggestion.lat, lng: suggestion.lng, ts: Date.now() });
            setTab("map");
            // «Магнит», «Кофейня Циферблат» и т.п. — подскажем это же имя как
            // название места, когда форма откроется тапом по пину (см. ниже).
            setPendingPlaceName(
              suggestion.name ? { lat: suggestion.lat, lng: suggestion.lng, name: suggestion.name } : null,
            );
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {showFilters && (
        <FilterSheet
          filters={filters}
          places={[...places, ...friendPlaces]}
          onApply={(nextFilters) => {
            setFocusedFriendId(null);
            setFilters(nextFilters);
          }}
          onClose={() => setShowFilters(false)}
        />
      )}

      {/* «Добавить папку» с грид-экрана «Папки» — не из формы места, там свой
          FolderPickerSheet со своим onCreateFolder (нечего сразу отмечать). */}
      {showCreateFolder && (
        <FolderNameSheet
          title="Как назовем папку?"
          confirmLabel={creatingFolder ? "Создаём…" : "Создать"}
          onConfirm={(title) => void handleCreateFolder(title)}
          onClose={() => setShowCreateFolder(false)}
        />
      )}

      {draftCoordinate && (
        <AddPlaceSheet
          coordinate={draftCoordinate}
          suggestedTitle={
            // Применимо, только если карта всё ещё стоит там же, где было
            // выбрано в поиске — иначе это уже другая точка (человек подвинул
            // карту вручную после выбора подсказки), и подставлять чужое имя
            // сюда нельзя.
            pendingPlaceName &&
            distanceMeters(
              { latitude: pendingPlaceName.lat, longitude: pendingPlaceName.lng },
              { latitude: draftCoordinate.lat, longitude: draftCoordinate.lng },
            ) <= 30
              ? pendingPlaceName.name
              : undefined
          }
          folders={folders}
          onCreateFolder={handleCreateFolder}
          onSave={async (place) => {
            const saved = await createPlace(toPlaceInput(place));
            // Новую запись сразу показываем в интерфейсе. Географический якорь
            // адресной группы определяется отдельно по createdAt, поэтому порядок
            // массива больше не способен сдвинуть уже существующий пин.
            setPlaces((prev) => [saved, ...prev]);
            // Счётчик/обложки папок в FoldersGrid могли устареть, если место
            // положили в папку прямо здесь — дешёвый перезапрос честнее, чем
            // пересчитывать это на фронте вручную.
            if (saved.folderIds && saved.folderIds.length > 0) loadFolders();
          }}
          onClose={() => {
            setDraftCoordinate(null);
            setPendingPlaceName(null);
          }}
        />
      )}

      {detailPlace && (
        <PlaceDetail
          place={detailPlace}
          onClose={() => setDetailPlace(null)}
          onShare={() => sharePlace(detailPlace)}
          onEdit={
            detailPlace.owner
              ? undefined
              : () => {
                  setEditingPlace(detailPlace);
                  setDetailPlace(null);
                }
          }
          onDelete={
            detailPlace.owner
              ? undefined
              : async () => {
                  await deletePlace(detailPlace.id);
                  setPlaces((prev) => prev.filter((p) => p.id !== detailPlace.id));
                  setSelectedPlaces([]);
                  setDetailPlace(null);
                }
          }
          onSaveCopy={
            detailPlace.owner
              ? async () => {
                  const saved = await createPlace(toPlaceInput(detailPlace));
                  setPlaces((prev) => [saved, ...prev]);
                  setDetailPlace(null);
                }
              : undefined
          }
        />
      )}

      {/* Редактирование места: та же форма с предзаполненными полями */}
      {editingPlace && (
        <AddPlaceSheet
          coordinate={{ lat: editingPlace.latitude, lng: editingPlace.longitude }}
          initialPlace={editingPlace}
          folders={folders}
          onCreateFolder={handleCreateFolder}
          onSave={async (updated) => {
            const saved = await updatePlace(editingPlace.id, toPlaceInput(updated));
            setPlaces((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
            setSelectedPlaces([]);
            // Принадлежность к папкам могла и добавиться, и пропасть —
            // перезагружаем список папок в обоих случаях, не только когда
            // итоговый набор не пуст.
            loadFolders();
          }}
          onClose={() => setEditingPlace(null)}
        />
      )}
    </div>
  );
}
