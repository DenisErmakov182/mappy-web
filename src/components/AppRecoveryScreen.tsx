import { Component, type ErrorInfo, type ReactNode } from "react";

async function recoverAppShell() {
  if ("serviceWorker" in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }

  if ("caches" in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)));
  }

  // Не трогаем localStorage: аккаунт, онбординг и сохранённая геопозиция
  // остаются на устройстве. Параметр заставляет CDN выполнить новую навигацию.
  const recoveryUrl = new URL(window.location.href);
  recoveryUrl.searchParams.set("recovery", Date.now().toString());
  window.location.replace(recoveryUrl.toString());
}

function AppRecoveryScreen() {
  return (
    <main className="fixed inset-0 flex flex-col items-center justify-center bg-white px-5 text-center">
      <div className="flex w-full max-w-sm flex-col items-center gap-4">
        <h1 className="text-[28px] font-semibold leading-[32px] text-[#1e2939]">Не удалось открыть Mappy</h1>
        <p className="max-w-[330px] text-[16px] leading-[22px] text-[#4a5565]">
          Обновим оболочку приложения. Аккаунт и сохранённые места останутся на месте.
        </p>
      </div>

      <div className="absolute bottom-[80px] left-5 right-5 mx-auto max-w-sm">
        <button
          type="button"
          onClick={() => void recoverAppShell()}
          className="h-14 w-full rounded-[14px] text-[16px] font-medium text-white"
          style={{ background: "var(--mappy-gradient-cta)" }}
        >
          Восстановить приложение
        </button>
      </div>
    </main>
  );
}

export class AppErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Mappy failed to render", error, info);
  }

  render() {
    return this.state.failed ? <AppRecoveryScreen /> : this.props.children;
  }
}
