import { useEffect, useRef } from 'react';
import { Platform, ScrollView, type ScrollViewInstance, type ScrollViewProps, View } from 'react-native';

import { measureFocusedInput, useKeyboardFrame } from '@/lib/keyboard';

/** Gap kept between the focused field and the keyboard. */
const MARGIN = 24;

/**
 * A ScrollView for forms: while the keyboard is open it adds room below the
 * content and scrolls the focused field up to just above the keyboard, on
 * Android, iPhone and in the browser alike.
 */
export function KeyboardAwareScrollView({ children, onScroll, ...props }: ScrollViewProps) {
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offset = useRef(0);
  const keyboard = useKeyboardFrame();

  useEffect(() => {
    if (keyboard.top == null) return;
    const keyboardTop = keyboard.top;
    // Let the spacer render (and on the web, the browser finish its own scrolling) first.
    const timer = setTimeout(
      async () => {
        const field = await measureFocusedInput();
        if (!field) return;
        const hidden = field.bottom + MARGIN - keyboardTop;
        if (hidden > 0) scrollRef.current?.scrollTo({ y: offset.current + hidden, animated: true });
      },
      Platform.OS === 'web' ? 150 : 50
    );
    return () => clearTimeout(timer);
  }, [keyboard.version, keyboard.top]);

  return (
    <ScrollView
      ref={scrollRef}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={(event) => {
        offset.current = event.nativeEvent.contentOffset.y;
        onScroll?.(event);
      }}
      {...props}>
      {children}
      <View style={{ height: keyboard.height }} />
    </ScrollView>
  );
}
