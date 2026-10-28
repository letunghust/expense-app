import { Alert, Platform } from 'react-native';

/**
 * Thin wrappers over Alert.alert. React Native Web's Alert is a no-op, so on
 * web these fall back to the browser's alert/confirm dialogs.
 */

export function showMessage(title: string, message: string) {
  if (Platform.OS === 'web') {
    window.alert(`${title}\n\n${message}`);
    return;
  }
  Alert.alert(title, message);
}

type ConfirmOptions = {
  title: string;
  message: string;
  confirmText: string;
  onConfirm: () => void;
};

export function confirmDestructive(options: ConfirmOptions) {
  confirm(options, 'destructive');
}

export function confirmAction(options: ConfirmOptions) {
  confirm(options, 'default');
}

function confirm({ title, message, confirmText, onConfirm }: ConfirmOptions, style: 'default' | 'destructive') {
  if (Platform.OS === 'web') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Hủy', style: 'cancel' },
    { text: confirmText, style, onPress: onConfirm },
  ]);
}
