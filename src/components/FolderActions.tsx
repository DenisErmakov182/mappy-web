import { useState, type ReactNode } from "react";
import { renameFolder, deleteFolder } from "../lib/api";
import { Sheet, CloseButton } from "./primitives";
import { ActionSheet } from "./ActionSheet";
import { FolderNameSheet } from "./FolderNameSheet";

/*
 * Меню «Редактировать название» / «Удалить» для папки — переиспользуется в
 * двух местах (узел 2374:12645 подтвердил: кнопка есть и прямо на карточке
 * в сетке, не только в шапке FolderDetailScreen, куда её добавили первой):
 * - FolderCard.tsx — кнопка на самой карточке в FoldersGrid;
 * - FolderDetailScreen.tsx — кнопка в шапке экрана внутри папки.
 *
 * Вынесено в хук, а не дублирует три шита (ActionSheet/FolderNameSheet/
 * FolderDeleteConfirmSheet) и их состояние в обоих местах.
 */
export function useFolderActions({
  folderId,
  folderTitle,
  onRenamed,
  onDeleted,
}: {
  folderId: string;
  folderTitle: string;
  onRenamed: (title: string) => void;
  onDeleted: () => void;
}) {
  const [showMenu, setShowMenu] = useState(false);
  const [showRename, setShowRename] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const saveRename = async (title: string) => {
    setRenaming(true);
    try {
      await renameFolder(folderId, title);
      onRenamed(title);
      setShowRename(false);
    } catch {
      // Оставляем шит открытым с уже введённым текстом — сеть подвела,
      // а не «название нельзя такое», человек может просто повторить.
    } finally {
      setRenaming(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    try {
      await deleteFolder(folderId);
      onDeleted();
    } catch {
      // Папку уже могли удалить на другом устройстве, или сеть подвела —
      // шит остаётся открытым, человек видит «Удаляем…» пропало и пробует ещё раз.
      setDeleting(false);
    }
  };

  const sheets: ReactNode = (
    <>
      {showMenu && (
        <ActionSheet
          actions={[
            { label: "Редактировать название", onClick: () => { setShowMenu(false); setShowRename(true); } },
            { label: "Удалить", color: "#ff3b30", onClick: () => { setShowMenu(false); setShowDeleteConfirm(true); } },
          ]}
          onCancel={() => setShowMenu(false)}
        />
      )}

      {showRename && (
        <FolderNameSheet
          title="Переименовать папку"
          confirmLabel={renaming ? "Сохраняем…" : "Сохранить"}
          initialValue={folderTitle}
          onConfirm={saveRename}
          onClose={() => !renaming && setShowRename(false)}
        />
      )}

      {showDeleteConfirm && (
        <FolderDeleteConfirmSheet
          folderTitle={folderTitle}
          deleting={deleting}
          onConfirm={confirmDelete}
          onClose={() => !deleting && setShowDeleteConfirm(false)}
        />
      )}
    </>
  );

  return { openMenu: () => setShowMenu(true), sheets };
}

/*
 * Подтверждение удаления папки (узел не задан отдельно владельцем — по его
 * словесному ТЗ 20.08.2026: дропдаун «…» → «Удалить» → этот шит → реальное
 * удаление). Места внутри папки НЕ удаляются — только явка папки как
 * подборки, каскад в БД уносит лишь связку folder_places (см. комментарий у
 * DELETE /folders/:id в mappy-api/src/routes/folders.ts). Подпись это
 * прямо проговаривает, чтобы не пугать человека.
 */
function FolderDeleteConfirmSheet({
  folderTitle,
  deleting,
  onConfirm,
  onClose,
}: {
  folderTitle: string;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet onClose={onClose}>
      <div className="flex flex-col gap-4 px-5 pb-4">
        <div className="flex items-start justify-between gap-3 pl-1">
          <div className="flex flex-col gap-1">
            <h3
              className="text-[22px] leading-7 font-semibold tracking-[-0.6px]"
              style={{ color: "var(--mappy-text-secondary)" }}
            >
              Удалить папку «{folderTitle}»?
            </h3>
            <p className="text-[14px] leading-[18px]" style={{ color: "var(--mappy-text-secondary)" }}>
              Места внутри папки никуда не денутся — они останутся в «Сохранённом» и на карте.
            </p>
          </div>
          <CloseButton onClick={onClose} />
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={deleting}
            className="h-14 flex-1 rounded-[14px] text-[16px] font-medium disabled:opacity-70"
            style={{ backgroundColor: "var(--mappy-surface-secondary)", color: "var(--mappy-text-secondary)" }}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={deleting}
            className="h-14 flex-1 rounded-[14px] text-[16px] font-medium text-white disabled:opacity-70"
            style={{ backgroundColor: "#fb2c36" }}
          >
            {deleting ? "Удаляем…" : "Удалить"}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
