import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { requireCurrentUserId } from '../../../lib/auth';
import { supabase } from '../../../lib/supabase';

export async function enablePushNotifications(): Promise<void> {
  if (Platform.OS === 'web') throw new Error('Push está disponível no aplicativo Android e iOS.');
  if (Constants.appOwnership === 'expo') throw new Error('Push exige uma versão instalada do nitin.');
  const Notifications = await import('expo-notifications');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('finance', {
      name: 'Alertas financeiros', importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
    });
  }
  const permission = await Notifications.getPermissionsAsync();
  const granted = permission.granted || (await Notifications.requestPermissionsAsync()).granted;
  if (!granted) throw new Error('Permita notificações nas configurações do aparelho para ativar push.');
  const userId = await requireCurrentUserId();
  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error('Projeto de push não configurado.');
  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  // The RPC transfers a shared device token to the currently authenticated account.
  const { error } = await supabase.rpc('register_notification_device', { p_token: token, p_platform: Platform.OS });
  if (error) throw new Error(error.message);
  if (await requireCurrentUserId() !== userId) throw new Error('A conta mudou. Ative as notificações novamente.');
}
