import { registerSW } from "virtual:pwa-register";

let pendingUpdate: (() => Promise<void>) | null = null;
let updateScheduled = false;
let updateStarted = false;
const reloadBlockers = new Set<symbol>();

function applyUpdateWhenSafe() {
  if (!pendingUpdate || reloadBlockers.size > 0 || updateScheduled || updateStarted) return;

  // React StrictMode temporarily unmounts and mounts effects again in development.
  // Recheck blockers in a microtask so that transient cleanup cannot reload a form.
  updateScheduled = true;
  queueMicrotask(() => {
    updateScheduled = false;
    if (!pendingUpdate || reloadBlockers.size > 0 || updateStarted) return;

    const update = pendingUpdate;
    pendingUpdate = null;
    updateStarted = true;
    void update().catch(() => {
      // Leave the current build running if activation fails. The next launch
      // will perform another registration update check.
      updateStarted = false;
      if (!pendingUpdate) pendingUpdate = update;
    });
  });
}

/**
 * Temporarily prevents a downloaded PWA build from activating and reloading
 * the page. Returns a release function; once the last blocker is released, a
 * pending update reloads exactly once.
 */
export function blockPwaUpdateReload() {
  const blocker = Symbol("pwa-update-reload-blocker");
  reloadBlockers.add(blocker);

  return () => {
    reloadBlockers.delete(blocker);
    applyUpdateWhenSafe();
  };
}

/**
 * Checks for one coherent build at application launch. Workbox finishes
 * precaching before the new worker activates. The currently running page then
 * reloads once, unless a form has temporarily blocked that reload.
 */
export function registerPwaUpdateHandling() {
  if (!("serviceWorker" in navigator)) return;

  let updateServiceWorker: (reloadPage?: boolean) => Promise<void> = async () => undefined;
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedRefresh() {
      // Keep the new worker waiting until forms are safe. Passing `true` asks
      // vite-plugin-pwa to activate it and reload the controlled page once.
      pendingUpdate = () => updateServiceWorker(true);
      applyUpdateWhenSafe();
    },
    onRegisteredSW(_swUrl, registration) {
      // One explicit check per application launch. Offline and network errors
      // are intentionally ignored so the installed build remains usable.
      registration?.update().catch(() => undefined);
    },
  });
}
