import { Redirect } from 'expo-router';
import { useAuth } from '../src/auth';

/** Keep `/` as a gate so it never collides with the tabs home route. */
export default function Index() {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (user) return <Redirect href="/(tabs)/home" />;
  return <Redirect href="/login" />;
}
