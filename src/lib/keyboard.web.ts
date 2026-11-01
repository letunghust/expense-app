import { useEffect, useState } from 'react';

import type { KeyboardFrame } from './keyboard';

export type { KeyboardFrame };

/** Below this the viewport change is browser chrome (the URL bar) moving, not a keyboard. */
const MIN_KEYBOARD_HEIGHT = 120;

/**
 * Browsers have no keyboard events; on phones the visual viewport shrinks
 * instead. public/index.html already pins the app to the visible area, so no
 * spacer is needed (`height` stays 0): only `top`, the bottom of the visible
 * area in page coordinates, for scrolling the focused field into view.
 */
export function useKeyboardFrame(): KeyboardFrame {
  const [frame, setFrame] = useState<KeyboardFrame>({ height: 0, top: null, version: 0 });
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const visibleBottom = () =>
      window.innerHeight - viewport.height * viewport.scale > MIN_KEYBOARD_HEIGHT
        ? viewport.offsetTop + viewport.height
        : null;
    const update = () =>
      setFrame((f) => {
        const top = visibleBottom();
        return top === f.top ? f : { height: 0, top, version: f.version + 1 };
      });
    // Moving to another field while the keyboard is open: reveal that one too.
    const onFocus = (event: FocusEvent) => {
      if (isTextField(event.target)) setFrame((f) => (f.top == null ? f : { ...f, version: f.version + 1 }));
    };
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    document.addEventListener('focusin', onFocus);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      document.removeEventListener('focusin', onFocus);
    };
  }, []);
  return frame;
}

/** Top and bottom of the focused text field in page coordinates. */
export async function measureFocusedInput(): Promise<{ top: number; bottom: number } | null> {
  const element = document.activeElement;
  if (!isTextField(element)) return null;
  const rect = element.getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom };
}

function isTextField(target: EventTarget | null): target is HTMLElement {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}
