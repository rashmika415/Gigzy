import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../FirebaseConfig';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

function tokenDocumentId(token: string) {
  return token.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export async function registerDeviceForPush(userId: string) {
  if (!Device.isDevice) return null;
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Gigzy updates',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#6FD8C7',
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const permission = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!permission.granted) return null;
  const deviceToken = await Notifications.getDevicePushTokenAsync();
  const token = String(deviceToken.data);
  await setDoc(doc(db, 'users', userId, 'pushTokens', tokenDocumentId(token)), {
    token,
    provider: deviceToken.type,
    platform: Platform.OS,
    updatedAt: serverTimestamp(),
  });
  return token;
}

export async function removeDevicePushToken(userId: string, token: string) {
  await deleteDoc(doc(db, 'users', userId, 'pushTokens', tokenDocumentId(token)));
}
