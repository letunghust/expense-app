import { useEffect, useState } from 'react';
import { Keyboard, Platform, TextInput } from 'react-native';

/**
 * Where the on-screen keyboard is. `top` is its upper edge in window
 * coordinates (null when hidden); `version` changes on every keyboard event,
 * so effects re-run even when the height stays the same.
 */
export type KeyboardFrame = { height: number; top: number | null; version: number };

export function useKeyboardFrame(): KeyboardFrame {
  const [frame, setFrame] = useState<KeyboardFrame>({ height: 0, top: null, version: 0 });
  useEffect(() => {
    // Android apps draw edge to edge, so the window no longer shrinks for the keyboard.
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) =>
      setFrame((f) => ({ height: e.endCoordinates.height, top: e.endCoordinates.screenY, version: f.version + 1 }))
    );
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
      setFrame((f) => ({ height: 0, top: null, version: f.version + 1 }))
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return frame;
}

/** Top and bottom of the focused text field in window coordinates. */
export function measureFocusedInput(): Promise<{ top: number; bottom: number } | null> {
  const input = TextInput.State.currentlyFocusedInput();
  if (!input) return Promise.resolve(null);
  return new Promise((resolve) => input.measureInWindow((_x, y, _width, height) => resolve({ top: y, bottom: y + height })));
}
