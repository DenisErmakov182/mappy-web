import { registerSW } from "virtual:pwa-register";

export type PwaUpdateStatus = "unavailable" | "idle" | "checking" | "available" | "error";

let registration: ServiceWorkerRegistration | undefined;
let observedRegistration: ServiceWorkerRegistration | undefined;
let status: PwaUpdateStatus = "unavailable";
const listeners = new Set<(nextStatus: PwaUpdateStatus) => void>();

function setStatus(nextStatus: PwaUpdateStatus) {
  status = nextStatus;
  listeners.forEach((listener) => listener(status));
}

function markUpdateAvailable() {
  setStatus("available");
}

function observeRegistration(nextRegistration: ServiceWorkerRegistration) {
  if (observedRegistration === nextRegistration) return;
  observedRegistration = nextRegistration;

  if (nextRegistration.waiting) {
    markUpdateAvailable();
    return;
  }

  nextRegistration.addEventListener("updatefound", () => {
    const worker = nextRegistration.installing;
    if (!worker) return;

    worker.addEventListener("statechange", () => {
      if (worker.state === "installed" && nextRegistration.waiting) {
        markUpdateAvailable();
      }
    });
  });
}

export function getPwaUpdateStatus() {
  return status;
}

export function subscribeToPwaUpdateStatus(listener: (nextStatus: PwaUpdateStatus) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Checks the already registered worker without activating it. A waiting worker
 * is announced to the UI, but remains waiting until every Mappy window closes.
 */
export async function checkForPwaUpdate() {
  if (!("serviceWorker" in navigator)) return false;

  try {
    registration ??= await navigator.serviceWorker.getRegistration();
    if (!registration) {
      setStatus("unavailable");
      return false;
    }

    observeRegistration(registration);
    if (registration.waiting) {
      markUpdateAvailable();
      return true;
    }

    setStatus("checking");
    await registration.update();

    if (registration.waiting) {
      markUpdateAvailable();
      return true;
    }

    setStatus("idle");
    return false;
  } catch (error) {
    console.error("PWA update check failed", error);
    setStatus("error");
    return false;
  }
}

/**
 * The worker never intercepts navigation, so this intentional reload receives
 * the current network shell. It does not message the waiting worker and does
 * not use skipWaiting.
 */
export function reloadForPwaUpdate() {
  window.location.reload();
}

/**
 * Registers the PWA without ever replacing or reloading the currently open
 * application. A downloaded worker remains in `waiting` and activates only
 * after every Mappy window has been closed. The next launch then starts on one
 * coherent build instead of switching runtimes in the middle of a session.
 */
export function registerPwaUpdateHandling() {
  if (!("serviceWorker" in navigator)) return;

  registerSW({
    immediate: true,
    // vite-plugin-pwa normally reloads after a waiting worker takes control.
    // Suppress that fallback as an additional guard against visible flashing.
    onNeedReload: () => undefined,
    onNeedRefresh: markUpdateAvailable,
    onRegisteredSW: (_swScriptUrl, nextRegistration) => {
      if (!nextRegistration) {
        setStatus("unavailable");
        return;
      }

      registration = nextRegistration;
      observeRegistration(nextRegistration);
      if (!nextRegistration.waiting) setStatus("idle");
    },
    onRegisterError: (error) => {
      console.error("PWA registration failed", error);
      setStatus("unavailable");
    },
  });
}
