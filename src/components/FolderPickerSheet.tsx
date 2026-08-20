import { useState } from "react";
import { Sheet, CloseButton } from "./primitives";
import { Icon } from "./design-system/00-foundations/Icon";
import { FolderNameSheet } from "./FolderNameSheet";
import { FolderArt } from "./FolderArt";
import type { Folder } from "../lib/api";

/*
 * «Сохранить в папку» — узел 2291:28094 (список уже есть) / 2291:27724
 * («Ваша первая папка» — тот же экран для случая, когда папок ещё нет,
 * см. FolderNameSheet, туда её и роутит AddPlaceSheet).
 *
 * Открывается поверх AddPlaceSheet — второй такой шит, первый см. в
 * FolderNameSheet. «Новая папка» здесь открывает FolderNameSheet ЕЩЁ ОДНИМ
 * уровнем выше (третий Sheet подряд) — по решению владельца 16.08.2026,
 * после создания папки закрывается только шит названия, а не оба сразу:
 * человек возвращается сюда же, и новая папка уже отмечена галочкой.
 */
function MiniFolderIcon() {
  // Тот же FolderArt, что у FolderCard/FolderNameSheet, в масштабе списка
  // (39px против базовых 195px — узел 2291:28448 подтверждает те же
  // пропорции 195:139, поэтому обёртка просто фиксирует ширину). Без фото:
  // тут это просто иконка папки, а не превью её содержимого.
  return (
    <span className="block shrink-0" style={{ width: 39 }}>
      <FolderArt coverPhotos={[]} />
    </span>
  );
}

function FolderRow({
  folder,
  selected,
  onToggle,
}: {
  folder: Folder;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-2.5 overflow-hidden rounded-[10px] p-2 text-left"
      style={{
        backgroundColor: selected ? "var(--mappy-brand-subtle)" : "white",
        border: selected ? "1.5px solid var(--mappy-pink)" : "1.5px solid transparent",
      }}
    >
      <MiniFolderIcon />
      <span className="truncate text-[16px] font-medium tracking-[-0.6px]" style={{ color: "var(--mappy-text-secondary)" }}>
        {folder.title}
      </span>
    </button>
  );
}

export function FolderPickerSheet({
  folders,
  initialSelectedIds,
  onCreateFolder,
  onSave,
  onClose,
}: {
  folders: Folder[];
  initialSelectedIds: string[];
  /** Создаёт папку на сервере и возвращает её — новая папка сразу отмечена. */
  onCreateFolder: (title: string) => Promise<Folder>;
  onSave: (selectedIds: string[]) => void;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelectedIds));
  const [localFolders, setLocalFolders] = useState(folders);
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [creating, setCreating] = useState(false);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const createFolder = async (title: string) => {
    setCreating(true);
    try {
      const folder = await onCreateFolder(title);
      setLocalFolders((prev) => [folder, ...prev]);
      setSelected((prev) => new Set(prev).add(folder.id));
      setShowNewFolder(false);
    } finally {
      setCreating(false);
    }
  };

  return (
    <>
      <Sheet onClose={onClose}>
        <div className="flex flex-col gap-6 px-5 pb-4">
          <div className="flex items-start justify-between gap-3 pl-1">
            <div className="flex flex-col gap-1">
              <h3
                className="text-[28px] leading-8 font-semibold tracking-[-0.6px]"
                style={{ color: "var(--mappy-text-secondary)" }}
              >
                Сохранить в папку
              </h3>
              <p className="text-[16px] leading-[18px]" style={{ color: "var(--mappy-text-tertiary)" }}>
                Выберите одни или несколько папок, куда хотите сохранить место
              </p>
            </div>
            <CloseButton onClick={onClose} />
          </div>

          <button
            type="button"
            onClick={() => setShowNewFolder(true)}
            className="flex items-center justify-center gap-1 rounded-[14px] px-3 py-2 text-[14px] font-medium"
            style={{ backgroundColor: "var(--mappy-brand-subtle)", color: "var(--mappy-pink)" }}
          >
            <Icon name="plus" className="size-4" />
            Новая папка
          </button>

          <div
            className="flex max-h-[45vh] flex-col gap-2 overflow-y-auto rounded-[14px] p-2.5"
            style={{ backgroundColor: "var(--mappy-surface-primary)" }}
          >
            {localFolders.map((folder) => (
              <FolderRow
                key={folder.id}
                folder={folder}
                selected={selected.has(folder.id)}
                onToggle={() => toggle(folder.id)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => onSave(Array.from(selected))}
            className="cta-gradient h-14 w-full shrink-0 rounded-[14px] text-[16px] font-medium"
          >
            Сохранить
          </button>
        </div>
      </Sheet>

      {showNewFolder && (
        <FolderNameSheet
          title="Как назовем папку?"
          confirmLabel={creating ? "Создаём…" : "Назвать"}
          onConfirm={createFolder}
          onClose={() => setShowNewFolder(false)}
        />
      )}
    </>
  );
}
