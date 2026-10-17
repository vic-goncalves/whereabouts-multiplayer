import { useLayoutEffect, type RefObject } from "react";

// Mounts a long-lived element (owned outside React) into this component's
// container for as long as the component is mounted.
export function useAttached(ref: RefObject<HTMLElement | null>, el: HTMLElement) {
  useLayoutEffect(() => {
    ref.current?.appendChild(el);
    return () => el.remove();
  }, [ref, el]);
}
