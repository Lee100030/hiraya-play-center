import { Body, Caption, Card, EmptyState, Screen, Title } from '../src/components/ui';
import { useAuth } from '../src/auth';
import { useCenter } from '../src/store';
import { isMobileTeacher } from '../src/rbac';

export default function TeacherNotesScreen() {
  const { user } = useAuth();
  const { store } = useCenter();
  const notes = (store.teacherNotes || []).filter((row) => row.teacherId === user?.userId && row.visibility === 'teacher');
  const comments = (store.teacherComments || []).filter(
    (row) => row.teacherId === user?.userId && row.visibility === 'teacher',
  );

  if (!isMobileTeacher(user?.role)) {
    return (
      <Screen>
        <EmptyState icon="lock-closed-outline" title="Teachers only" hint="Admin notes that are marked visible appear here." />
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Notes & comments</Title>
      <Caption>Only items the Super Administrator marked visible to you.</Caption>
      {notes.map((row) => (
        <Card key={row.noteId}>
          <Body>{row.title}</Body>
          <Caption>{row.content}</Caption>
        </Card>
      ))}
      {comments.map((row) => (
        <Card key={row.commentId}>
          <Body>{row.content}</Body>
          {row.reply ? <Caption>Reply: {row.reply}</Caption> : null}
        </Card>
      ))}
      {!notes.length && !comments.length ? (
        <EmptyState icon="document-text-outline" title="No visible notes" hint="Private admin notes never appear here." />
      ) : null}
    </Screen>
  );
}
