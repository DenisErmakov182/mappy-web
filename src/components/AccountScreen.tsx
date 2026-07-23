import { useRef, useState, type ReactNode } from "react";
import { uploadAvatar, type ApiUser } from "../lib/api";
import { cropSquareImage } from "../lib/image";

type ConfirmAction = "logout" | "delete" | null;

type AccountScreenProps = {
  user: ApiUser;
  onClose: () => void;
  onUserUpdated: (user: ApiUser) => void;
  onLogout: () => void;
  onDeleteAccount: () => Promise<void>;
};

export function AccountScreen({
  user,
  onClose,
  onUserUpdated,
  onLogout,
  onDeleteAccount,
}: AccountScreenProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const displayName = user.name ?? user.username ?? user.email;
  const initials = displayName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const changeAvatar = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const prepared = await prepareAvatar(file);
      const updatedUser = await uploadAvatar(prepared);
      onUserUpdated(updatedUser);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Не удалось обновить фотографию");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const confirmDelete = async () => {
    if (deleting) return;
    setDeleting(true);
    setError("");
    try {
      await onDeleteAccount();
    } catch (deleteError) {
      setDeleting(false);
      setConfirmAction(null);
      setError(deleteError instanceof Error ? deleteError.message : "Не удалось удалить аккаунт");
    }
  };

  return (
    <div className="account-screen" role="dialog" aria-modal="true" aria-label="Аккаунт">
      <button className="account-back-button" onClick={onClose} aria-label="Вернуться к друзьям">
        <AccountIcon name="chevron" />
        <span>Выйти</span>
      </button>

      <div className="account-content">
        <div className="account-avatar-wrap">
          <div className="account-avatar" aria-label={`Фото профиля ${displayName}`}>
            {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{initials}</span>}
            {uploading && <span className="account-avatar-loading">Загрузка…</span>}
          </div>
          <button
            type="button"
            className="account-avatar-edit"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            aria-label="Изменить фотографию"
          >
            <AccountIcon name="edit" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="sr-only"
            onChange={(event) => changeAvatar(event.target.files?.[0])}
          />
        </div>

        <div className="account-card-stack">
          <AccountCard title="Личные данные">
            <ReadonlyField value={user.firstName} fallback="Имя" />
            <ReadonlyField value={user.lastName} fallback="Фамилия" />
            <ReadonlyField value={user.username} fallback="Никнейм" />
          </AccountCard>

          <AccountCard title="Контактные данные">
            <ReadonlyField value={user.email} fallback="Электронная почта" />
          </AccountCard>
        </div>

        {error && <p className="account-error" role="alert">{error}</p>}
      </div>

      <div className="account-actions">
        <button type="button" className="account-action-button account-action-logout" onClick={() => setConfirmAction("logout")}>
          <span>Выйти из аккаунта</span>
          <AccountIcon name="logout" />
        </button>
        <button type="button" className="account-action-button account-action-delete" onClick={() => setConfirmAction("delete")}>
          <span>Удалить аккаунт</span>
          <AccountIcon name="trash" />
        </button>
      </div>

      {confirmAction === "logout" && (
        <AccountConfirmationSheet
          title="Выйти из аккаунта?"
          primaryLabel="Не выходить"
          secondaryLabel="Выйти"
          onClose={() => setConfirmAction(null)}
          onPrimary={() => setConfirmAction(null)}
          onSecondary={onLogout}
        />
      )}

      {confirmAction === "delete" && (
        <AccountConfirmationSheet
          title="Удалить аккаунт?"
          description="После удаления аккаунта все ваши данные будут стерты без возможности восстановления"
          primaryLabel="Не удалять"
          secondaryLabel={deleting ? "Удаление…" : "Удалить"}
          onClose={() => !deleting && setConfirmAction(null)}
          onPrimary={() => setConfirmAction(null)}
          onSecondary={confirmDelete}
          secondaryDisabled={deleting}
        />
      )}
    </div>
  );
}

function AccountCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="account-card">
      <h2>{title}</h2>
      <div className="account-fields">{children}</div>
    </section>
  );
}

function ReadonlyField({ value, fallback }: { value: string | null; fallback: string }) {
  return (
    <div className={`account-readonly-field ${value ? "" : "account-readonly-field-empty"}`} aria-readonly="true">
      {value || fallback}
    </div>
  );
}

function AccountConfirmationSheet({
  title,
  description,
  primaryLabel,
  secondaryLabel,
  onClose,
  onPrimary,
  onSecondary,
  secondaryDisabled = false,
}: {
  title: string;
  description?: string;
  primaryLabel: string;
  secondaryLabel: string;
  onClose: () => void;
  onPrimary: () => void;
  onSecondary: () => void;
  secondaryDisabled?: boolean;
}) {
  return (
    <div className="account-confirm-backdrop" onClick={onClose}>
      <div
        className={`account-confirm-sheet ${description ? "account-confirm-sheet-delete" : "account-confirm-sheet-logout"}`}
        onClick={(event) => event.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="account-confirm-title"
      >
        <div className="account-confirm-grabber" />
        <div className="account-confirm-copy">
          <div className="account-confirm-heading">
            <h2 id="account-confirm-title">{title}</h2>
            <button type="button" onClick={onClose} aria-label="Закрыть">
              <AccountIcon name="close" />
            </button>
          </div>
          {description && <p>{description}</p>}
        </div>
        <div className="account-confirm-actions">
          <button type="button" className="account-confirm-primary" onClick={onPrimary}>{primaryLabel}</button>
          <button type="button" className="account-confirm-secondary" onClick={onSecondary} disabled={secondaryDisabled}>
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccountIcon({ name }: { name: "chevron" | "edit" | "logout" | "trash" | "close" }) {
  const paths = {
    chevron: <path d="M15 18l-6-6 6-6" />,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 013 3L8 18l-4 1 1-4z" /></>,
    logout: <><path d="M10 17l5-5-5-5" /><path d="M15 12H3" /><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /></>,
    trash: <><path d="M3 6h18" /><path d="M8 6V4h8v2" /><path d="M19 6l-1 15H6L5 6" /><path d="M10 11v6M14 11v6" /></>,
    close: <><path d="M6 6l12 12" /><path d="M18 6L6 18" /></>,
  } as const;
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

async function prepareAvatar(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) throw new Error("Выберите изображение");
  if (file.size > 15 * 1024 * 1024) throw new Error("Фотография должна весить не больше 15 МБ");
  return cropSquareImage(file, 512, "avatar");
}
