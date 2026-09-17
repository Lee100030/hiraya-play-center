import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';

export type PreparedPhoto = { uri: string; name: string };

async function prepare(uri: string): Promise<PreparedPhoto> {
  const square = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 512 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: square.uri, name: 'profile.jpg' };
}

async function fromResult(result: ImagePicker.ImagePickerResult): Promise<PreparedPhoto | null> {
  if (result.canceled || !result.assets?.[0]?.uri) return null;
  return prepare(result.assets[0].uri);
}

export async function pickProfilePhoto(source: 'library' | 'camera'): Promise<PreparedPhoto | null> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };

  if (source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Camera needed', 'Allow camera access to take a profile photo.');
      return null;
    }
    return fromResult(await ImagePicker.launchCameraAsync(options));
  }

  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    Alert.alert('Photos needed', 'Allow photo library access to choose a profile picture.');
    return null;
  }
  return fromResult(await ImagePicker.launchImageLibraryAsync(options));
}

export function askProfilePhotoSource(onPick: (source: 'library' | 'camera') => void, onRemove?: () => void) {
  const buttons: { text: string; style?: 'cancel' | 'destructive'; onPress?: () => void }[] = [
    { text: 'Choose from library', onPress: () => onPick('library') },
    { text: 'Take photo', onPress: () => onPick('camera') },
  ];
  if (onRemove) buttons.push({ text: 'Remove photo', style: 'destructive', onPress: onRemove });
  buttons.push({ text: 'Cancel', style: 'cancel' });
  Alert.alert('Profile photo', 'Use a clear, well-lit photo of your face.', buttons, { cancelable: true });
}
