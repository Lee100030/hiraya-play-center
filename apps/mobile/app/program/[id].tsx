import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';
import { AppButton, Body, Caption, Card, EmptyState, Screen, StatusBadge, Title, Heading } from '../../src/components/ui';
import { useCenter } from '../../src/store';
import { displayName } from '@hiraya/utils';

export default function ProgramDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { store } = useCenter();
  const router = useRouter();
  const program = store.programs.find((item) => item.programId === id);
  const classes = store.classes.filter((item) => item.programId === id);

  if (!program) {
    return (
      <Screen>
        <EmptyState title="Program not found" hint="Open Programs from Home after your workspace has loaded." />
        <AppButton label="Back to programs" onPress={() => router.push('/programs')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <StatusBadge status={program.status} />
      <Title>{program.name}</Title>
      <Body>{program.description || 'No additional description has been published.'}</Body>
      <Card>
        <Heading>Classes</Heading>
        {classes.length === 0 ? (
          <Caption>Class groups are assigned after enrollment is approved.</Caption>
        ) : (
          classes.map((item) => (
            <View key={item.classId} style={{ marginTop: 10 }}>
              <Body>{item.name}</Body>
              <Caption>
                {item.scheduleNotes || item.room || 'Schedule after placement'}
                {item.teacherId
                  ? ` · ${displayName(store.users.find((user) => user.userId === item.teacherId)) || 'Teacher assigned'}`
                  : ''}
              </Caption>
            </View>
          ))
        )}
      </Card>
      <AppButton label="Enroll now" onPress={() => router.push({ pathname: '/enroll', params: { program: program.name } })} />
    </Screen>
  );
}
