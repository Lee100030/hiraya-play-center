import { Linking } from 'react-native';
import { api } from './auth';

export async function openLearningModule(moduleId: string) {
  const url = await api.moduleFileUrl(moduleId);
  await Linking.openURL(url);
}
