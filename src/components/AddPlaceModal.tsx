import { useState } from "react";
import { allCategories, categoryLabel, type Place, type PlaceCategory, type VisitStatus, visitStatusLabel } from "../types";

interface Props {
  coordinate: { lat: number; lng: number };
  onSave: (place: Place) => void;
  onClose: () => void;
}

export function AddPlaceModal({ coordinate, onSave, onClose }: Props) {
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [rating, setRating] = useState(0);
  const [categories, setCategories] = useState<Set<PlaceCategory>>(new Set());
  const [note, setNote] = useState("");
  const [status, setStatus] = useState<VisitStatus>("been");

  const toggleCategory = (category: PlaceCategory) => {
    setCategories((prev) => {
      const next = new Set(prev);
      next.has(category) ? next.delete(category) : next.add(category);
      return next;
    });
  };

  const handleSave = () => {
    if (!title.trim()) return;
    onSave({
      id: crypto.randomUUID(),
      title: title.trim(),
      address: address.trim(),
      latitude: coordinate.lat,
      longitude: coordinate.lng,
      rating,
      categories: [...categories],
      note: note.trim(),
      status,
      photoUrls: [],
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/30" onClick={onClose}>
      <div
        className="w-full sm:max-w-md bg-white rounded-t-[28px] sm:rounded-[28px] max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/5">
          <button onClick={onClose} className="text-[15px] text-gray-500">
            Отмена
          </button>
          <span className="text-[16px] font-semibold">Новая точка</span>
          <button
            onClick={handleSave}
            disabled={!title.trim()}
            className="text-[15px] font-semibold disabled:opacity-30"
            style={{ color: "var(--mappy-pink)" }}
          >
            Добавить
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Название"
              className="h-12 px-4 rounded-xl text-[16px] outline-none"
              style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
            />
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Адрес"
              className="h-12 px-4 rounded-xl text-[16px] outline-none"
              style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
            />
          </div>

          <section>
            <h3 className="text-[17px] font-semibold mb-3">Оценка</h3>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} onClick={() => setRating(star)} className="text-[28px] leading-none">
                  {star <= rating ? "★" : "☆"}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[17px] font-semibold mb-3">Статус</h3>
            <div className="flex p-1 rounded-xl" style={{ backgroundColor: "var(--mappy-surface-secondary)" }}>
              {(["been", "planning"] as VisitStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setStatus(s)}
                  className="flex-1 text-[15px] font-medium py-2.5 rounded-lg"
                  style={{
                    backgroundColor: status === s ? "#fff" : "transparent",
                    color: status === s ? "#0a0a0a" : "#6b7280",
                  }}
                >
                  {visitStatusLabel[s]}
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[17px] font-semibold mb-3">Категории</h3>
            <div className="grid grid-cols-2 gap-2">
              {allCategories.map((category) => {
                const isSelected = categories.has(category);
                return (
                  <button
                    key={category}
                    onClick={() => toggleCategory(category)}
                    className="text-[15px] font-medium px-3.5 py-2.5 rounded-xl text-center"
                    style={{
                      backgroundColor: isSelected ? "var(--mappy-brand-subtle)" : "var(--mappy-surface-secondary)",
                      color: isSelected ? "var(--mappy-pink)" : "#0a0a0a",
                    }}
                  >
                    {categoryLabel[category]}
                  </button>
                );
              })}
            </div>
          </section>

          <section>
            <h3 className="text-[17px] font-semibold mb-3">Заметка</h3>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Расскажите, как вам место?"
              rows={3}
              className="w-full p-4 rounded-xl text-[16px] outline-none resize-none"
              style={{ backgroundColor: "var(--mappy-surface-secondary)" }}
            />
          </section>
        </div>
      </div>
    </div>
  );
}
