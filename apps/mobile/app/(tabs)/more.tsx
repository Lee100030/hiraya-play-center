import { useRouter } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useAuth } from '../../src/auth';

export default function MoreTab() {
  const { logout, user } = useAuth();
  const router = useRouter();
  return (
    <View style={{ flex: 1, backgroundColor: '#F7F1E1', padding: 16 }}>
      <Text style={{ fontSize: 20, color: '#0B3D2E' }}>{user?.fullname}</Text>
      <Text>{user?.email}</Text>
      <Pressable
        onPress={async () => {
          await logout();
          router.replace('/');
        }}
        style={{ marginTop: 24, backgroundColor: '#D4AF37', padding: 14, borderRadius: 999, alignItems: 'center' }}
      >
        <Text>Sign out</Text>
      </Pressable>
    </View>
  );
}
