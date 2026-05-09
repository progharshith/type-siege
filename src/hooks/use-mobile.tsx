/**
 * useIsMobile hook.
 *
 * Returns true when the viewport width is below the mobile breakpoint (768 px).
 * Uses a MediaQueryList for efficient change detection — no polling or resize
 * listeners on the window object directly.
 *
 * Returns `false` during SSR (window is not available) and resolves to the
 * correct value after hydration.
 *
 * Author: progharshith (https://github.com/progharshith)
 */

import * as React from "react";

/** Viewport width in pixels below which the device is considered "mobile". */
const MOBILE_BREAKPOINT = 768;

/**
 * Subscribe to the viewport width and return whether it is below
 * `MOBILE_BREAKPOINT`.  Starts as `undefined` during SSR and is set to
 * the correct boolean value after the first client-side effect runs.
 */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    /** Listen for future breakpoint crossings. */
    mql.addEventListener("change", onChange);
    /** Set the initial value synchronously inside the effect. */
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  /** Coerce `undefined` (SSR) to `false` for safe boolean usage in JSX. */
  return !!isMobile;
}
