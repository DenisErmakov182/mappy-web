import { useEffect, useMemo, useState } from "react";
import { TabBar, type AppTab } from "./components/TabBar";
import { SearchFilterBar } from "./components/SearchFilterBar";
import { FilterSheet } from "./components/FilterSheet";
import { MapView } from "./components/MapView";
import { CenterPin } from "./components/CenterPin";
import { AddPlaceSheet } from "./components/AddPlaceSheet";
import { PlaceDetail } from "./components/PlaceDetail";
import { PlaceCardCarousel } from "./components/PlaceCardCarousel";
import { NotesList } from "./components/NotesList";
import { FriendsScreen } from "./components/FriendsScreen";
import { SearchOverlay } from "./components/SearchOverlay";
import { AuthScreen } from "./components/AuthScreen";
import { OnboardingScreen, hasSeenOnboarding } from "./components/OnboardingScreen";
import { LocationPermissionScreen } from "./components/LocationPermissionScreen";
import locateMeIcon from "./assets/icons/locate-me-3d.png";
import {
  getToken,
  setToken as persistToken,
  clearToken,
  getMe,
  fetchPlaces,
  createPlace,
  updatePlace,
  deletePlace,
  type ApiUser,
  type PlaceInput,
} from "./lib/api";
import {
  emptyFilters,
  filtersAreEmpty,
  placeMatchesFilters,
  type Place,
  type PlaceFilters,
} from "./types";

const LAST_LOCATION_KEY = "mappy_last_location";
const LOCATION_PROMPT_COMPLETED_KEY = "mappy_location_prompt_completed";
const MAP_WITHOUT_LOCATION = { center: { lat: 61.524, lng: 105.3188 }, zoom: 3 };

type MapLaunchState = {
  center: { lat: number; lng: number };
  zoom: number;
};

function getStoredLocation(): { lat: number; lng: number } | null {
  try {
    const raw = localStorage.getItem(LAST_LOCATION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function storeLocation(lat: number, lng: number) {
  try {
    localStorage.setItem(LAST_LOCATION_KEY, JSON.stringify({ lat, lng }));
  } catch {
    // localStorage недоступен (приватный режим и т.п.) — не критично
  }
}

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

function toPlaceInput(place: Place): PlaceInput {
  return {
    title: place.title,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    rating: place.rating,
    categories: place.categories,
    note: place.note,
    status: place.status,
    photoUrls: place.photoUrls,
  };
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => getToken());
  const [user, setUser] = useState<ApiUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => !hasSeenOnboarding());
  const [mapLaunch, setMapLaunch] = useState<MapLaunchState | null>(() => {
    const stored = getStoredLocation();
    if (stored) return { center: stored, zoom: 12 };
    return hasCompletedLocationPrompt() ? MAP_WITHOUT_LOCATION : null;
  });

  useEffect(() => {
    if (!token) {
      setAuthChecked(true);
      return;
    }
    getMe()
      .then((u) => setUser(u))
      .catch(() => {
        clearToken();
        setToken(null);
      })
      .finally(() => setAuthChecked(true));
  }, [token]);

  if (!authChecked) return null;

  if (!token || !user) {
    return (
      <AuthScreen
        onAuthenticated={(newToken, newUser, isNew) => {
          persistToken(newToken);
          setToken(newToken);
          setUser(newUser);
          if (isNew) setShowOnboarding(true);
        }}
      />
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onDone={() => setShowOnboarding(false)} />;
  }

  if (!mapLaunch) {
    return (
      <LocationPermissionScreen
        onLocated={(coordinates) => {
          storeLocation(coordinates.lat, coordinates.lng);
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
      onLogout={() => {
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
  onLogout,
}: {
  user: ApiUser;
  initialCenter: { lat: number; lng: number };
  initialZoom: number;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<AppTab>("map");
  const [places, setPlaces] = useState<Place[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<PlaceFilters>(emptyFilters());
  const [showFilters, setShowFilters] = useState(false);
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedPlaces, setSelectedPlaces] = useState<Place[]>([]);
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const [center, setCenter] = useState(initialCenter);
  const [isMapMoving, setIsMapMoving] = useState(false);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);
  const [flyTo, setFlyTo] = useState<{ lat: number; lng: number; ts: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [placesError, setPlacesError] = useState(false);
  const [loadingPlaces, setLoadingPlaces] = useState(false);

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

  const locateMe = (silent = false) => {
    if (!navigator.geolocation) return;
    if (!silent) setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude: lat, longitude: lng } = pos.coords;
        storeLocation(lat, lng);
        setCenter({ lat, lng });
        // При автозапуске карта уже открыта примерно в нужном месте (сохранённые
        // координаты) — анимированный перелёт нужен только по ручному нажатию кнопки.
        if (!silent) setFlyTo({ lat, lng, ts: Date.now() });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const visiblePlaces = useMemo(() => {
    return places.filter((place) => {
      if (!placeMatchesFilters(place, filters)) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return place.title.toLowerCase().includes(q) || place.address.toLowerCase().includes(q);
    });
  }, [places, filters, query]);

  return (
    <div className="fixed inset-0 overflow-hidden bg-white">
      {/* Контент вкладок */}
      <div className="absolute inset-0">
        {tab === "map" && (
          <MapView
            places={visiblePlaces}
            center={center}
            initialZoom={initialZoom}
            onCenterChange={setCenter}
            onSelectPlace={setSelectedPlaces}
            onMovingChange={setIsMapMoving}
            flyTo={flyTo}
          />
        )}
        {tab === "notes" && (
          <NotesList
            places={visiblePlaces}
            onSelectPlace={setDetailPlace}
            onGoToMap={() => setTab("map")}
          />
        )}
        {tab === "friends" && <FriendsScreen user={user} onLogout={onLogout} />}
      </div>

      {/* Блюр-градиенты сверху и снизу (по макету 1489:15421 — без белых подложек) */}
      {tab !== "friends" && <div className="blur-edge-top" />}
      <div className="blur-edge-bottom" />

      {/* Верхняя зона: поиск + фильтр (на карте и в заметках) */}
      {tab !== "friends" && (
        <div className="absolute top-0 left-0 right-0 px-4 pt-[max(env(safe-area-inset-top),12px)]">
          <SearchFilterBar
            query={query}
            onOpenSearch={() => setShowSearch(true)}
            onClearQuery={() => setQuery("")}
            hasActiveFilters={!filtersAreEmpty(filters)}
            onFilterTap={() => setShowFilters(true)}
          />
        </div>
      )}

      {/* Баннер ошибки загрузки мест — данные не потеряны, просто не подгрузились */}
      {placesError && (
        <div className="absolute top-[max(env(safe-area-inset-top),12px)] left-4 right-4 z-50 mt-14 flex items-center justify-between gap-3 rounded-2xl bg-[#1e2939] px-4 py-3 text-sm text-white">
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

      {/* Главный пин в центре карты — тап добавляет место в этой точке */}
      {tab === "map" && selectedPlaces.length === 0 && (
        <CenterPin isMoving={isMapMoving} onClick={() => setShowAddPlace(true)} />
      )}

      {/* Кнопка «Где я»: перелёт к геолокации пользователя */}
      {tab === "map" && (
        <button
          onClick={() => locateMe()}
          className="absolute right-4 bottom-[110px] w-12 h-12 rounded-full bg-white flex items-center justify-center"
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
        <div className="absolute left-0 right-0 bottom-[100px]">
          <PlaceCardCarousel
            places={selectedPlaces}
            onSelect={(place) => {
              setDetailPlace(place);
              setSelectedPlaces([]);
            }}
          />
        </div>
      )}

      {/* Таббар */}
      <div className="absolute bottom-0 left-0 right-0 px-4 pb-[max(env(safe-area-inset-bottom),12px)]">
        <TabBar
          selection={tab}
          onSelect={(t) => {
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
          onSubmit={setQuery}
          onSelectPlace={(place) => {
            setCenter({ lat: place.latitude, lng: place.longitude });
            setSelectedPlaces([place]);
            setTab("map");
          }}
          onClose={() => setShowSearch(false)}
        />
      )}

      {showFilters && (
        <FilterSheet
          filters={filters}
          places={places}
          onApply={setFilters}
          onClose={() => setShowFilters(false)}
        />
      )}

      {showAddPlace && (
        <AddPlaceSheet
          coordinate={center}
          onSave={async (place) => {
            const saved = await createPlace(toPlaceInput(place));
            setPlaces((prev) => [...prev, saved]);
          }}
          onClose={() => setShowAddPlace(false)}
        />
      )}

      {detailPlace && (
        <PlaceDetail
          place={detailPlace}
          onClose={() => setDetailPlace(null)}
          onEdit={() => {
            setEditingPlace(detailPlace);
            setDetailPlace(null);
          }}
          onDelete={async () => {
            await deletePlace(detailPlace.id);
            setPlaces((prev) => prev.filter((p) => p.id !== detailPlace.id));
            setSelectedPlaces([]);
            setDetailPlace(null);
          }}
        />
      )}

      {/* Редактирование места: та же форма с предзаполненными полями */}
      {editingPlace && (
        <AddPlaceSheet
          coordinate={{ lat: editingPlace.latitude, lng: editingPlace.longitude }}
          initialPlace={editingPlace}
          onSave={async (updated) => {
            const saved = await updatePlace(editingPlace.id, toPlaceInput(updated));
            setPlaces((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
            setSelectedPlaces([]);
          }}
          onClose={() => setEditingPlace(null)}
        />
      )}
    </div>
  );
}
