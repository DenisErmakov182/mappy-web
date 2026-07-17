import { useEffect, useMemo, useState } from "react";
import { TabBar, type AppTab } from "./components/TabBar";
import { SearchFilterBar } from "./components/SearchFilterBar";
import { FilterSheet } from "./components/FilterSheet";
import { MapView } from "./components/MapView";
import { CenterPin } from "./components/CenterPin";
import { AddPlaceSheet } from "./components/AddPlaceSheet";
import { PlaceDetail } from "./components/PlaceDetail";
import { PlaceRowCard } from "./components/PlaceRowCard";
import { NotesList } from "./components/NotesList";
import { FriendsScreen } from "./components/FriendsScreen";
import { SearchOverlay } from "./components/SearchOverlay";
import { AuthScreen } from "./components/AuthScreen";
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
        onAuthenticated={(newToken, newUser) => {
          persistToken(newToken);
          setToken(newToken);
          setUser(newUser);
        }}
      />
    );
  }

  return (
    <MapApp
      user={user}
      onLogout={() => {
        clearToken();
        setToken(null);
        setUser(null);
      }}
    />
  );
}

function MapApp({ user, onLogout }: { user: ApiUser; onLogout: () => void }) {
  const [tab, setTab] = useState<AppTab>("map");
  const [places, setPlaces] = useState<Place[]>([]);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<PlaceFilters>(emptyFilters());
  const [showFilters, setShowFilters] = useState(false);
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const [center, setCenter] = useState({ lat: 48.8566, lng: 2.3522 });
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

  const locateMe = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        setCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setFlyTo({ lat: pos.coords.latitude, lng: pos.coords.longitude, ts: Date.now() });
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => {
    locateMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            onCenterChange={setCenter}
            onSelectPlace={setSelectedPlace}
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
      {tab === "map" && !selectedPlace && (
        <CenterPin isMoving={isMapMoving} onClick={() => setShowAddPlace(true)} />
      )}

      {/* Кнопка «Где я»: перелёт к геолокации пользователя */}
      {tab === "map" && (
        <button
          onClick={locateMe}
          className="absolute right-4 bottom-[110px] w-12 h-12 rounded-full bg-white flex items-center justify-center"
          aria-label="Моё местоположение"
        >
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            className={locating ? "animate-pulse" : undefined}
          >
            <path
              d="M21 3L3 10.5L10.5 13.5L13.5 21L21 3Z"
              stroke="#1e2939"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={locating ? "#1e2939" : "none"}
            />
          </svg>
        </button>
      )}

      {/* Плавающая карточка выбранного места над таббаром */}
      {tab === "map" && selectedPlace && (
        <div className="absolute left-4 right-4 bottom-[100px]">
          <PlaceRowCard
            place={selectedPlace}
            onClick={() => {
              setDetailPlace(selectedPlace);
              setSelectedPlace(null);
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
            setSelectedPlace(null);
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
            setSelectedPlace(place);
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
            setSelectedPlace(null);
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
            setSelectedPlace(null);
          }}
          onClose={() => setEditingPlace(null)}
        />
      )}
    </div>
  );
}
