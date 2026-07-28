import { registerSW } from "virtual:pwa-register";

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
    onRegisterError: (error) => console.error("PWA registration failed", error),
  });
}
