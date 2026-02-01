import type { Action } from 'svelte/action';

export interface SwipeHandlers {
  onSwipeStart?: (e: TouchEvent) => void;
  onSwipeMove?: (e: TouchEvent) => void;
  onSwipeEnd?: (e: TouchEvent) => void;
}

/**
 * Svelte action for handling touch swipe events with passive listeners.
 * This prevents the browser warning about non-passive event listeners blocking scroll.
 */
export const swipe: Action<HTMLElement, SwipeHandlers> = (node, handlers) => {
  let currentHandlers = handlers;

  const handleTouchStart = (e: TouchEvent) => {
    currentHandlers?.onSwipeStart?.(e);
  };

  const handleTouchMove = (e: TouchEvent) => {
    currentHandlers?.onSwipeMove?.(e);
  };

  const handleTouchEnd = (e: TouchEvent) => {
    currentHandlers?.onSwipeEnd?.(e);
  };

  // Add passive event listeners
  node.addEventListener('touchstart', handleTouchStart, { passive: true });
  node.addEventListener('touchmove', handleTouchMove, { passive: true });
  node.addEventListener('touchend', handleTouchEnd, { passive: true });

  return {
    update(newHandlers) {
      currentHandlers = newHandlers;
    },
    destroy() {
      node.removeEventListener('touchstart', handleTouchStart);
      node.removeEventListener('touchmove', handleTouchMove);
      node.removeEventListener('touchend', handleTouchEnd);
    },
  };
};
