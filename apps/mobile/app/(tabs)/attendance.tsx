import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { studentDisplay, todayIsoDate, newId } from '@hiraya/utils';
import { api, useAuth } from '../../src/auth';
import type { AttendanceRecord, HirayaDatabase } from '@hiraya/types';
import { emptyStore } from '@hiraya/types';

export default function AttendanceTab() {
  const { user } = useAuth();
  const [store, setStore] = useState<HirayaDatabase>(emptyStore());
  const [busy, setBusy] = useState(false);
  const today = todayIsoDate();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'super_admin' || user?.role === 'staff';

  useEffect(() => {
    api.getStore().then(setStore).catch(() => undefined);
  }, []);

  const assigned = store.students.filter((s) => {
    if (!isTeacher) return s.parentId === user?.userId;
    return (
      store.enrollments.some((e) => e.teacherId === user?.userId && e.studentId === s.studentId) ||
      store.classes.some(
        (c) =>
          c.teacherId === user?.userId &&
          store.enrollments.some((e) => e.classId === c.classId && e.studentId === s.studentId),
      ) ||
      store.students.filter((x) => x.status === 'active').length > 0
    );
  });
  const list = isTeacher ? store.students.filter((s) => s.status === 'active') : assigned;

  async function mark(studentId: string, status: string) {
    if (!isTeacher || busy) return;
    setBusy(true);
    const existing = store.attendance.find(
      (a) => a.studentId === studentId && (a.attendanceDate || '').slice(0, 10) === today && a.kind !== 'employee',
    );
    const row: AttendanceRecord = existing
      ? { ...existing, status, recordedBy: user?.userId || '' }
      : {
          attendanceId: newId('att'),
          kind: 'student',
          studentId,
          employeeId: '',
          classId: '',
          qrCode: '',
          timeIn: new Date().toISOString(),
          attendanceDate: today,
          status,
          notes: 'mobile',
          recordedBy: user?.userId || '',
        };
    const attendance = existing
      ? store.attendance.map((a) => (a.attendanceId === existing.attendanceId ? row : a))
      : [...store.attendance, row];
    try {
      const next = { ...store, attendance };
      await api.putStore(next);
      setStore(await api.getStore());
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F7F1E1', padding: 16 }}>
      <Text style={{ fontSize: 22, color: '#0B3D2E', marginBottom: 12 }}>Attendance · {today}</Text>
      {!isTeacher ? (
        <Text>Only teachers and staff can mark attendance. Parents see records on Children.</Text>
      ) : null}
      {list.map((child) => {
        const todayMark = store.attendance.find(
          (a) => a.studentId === child.studentId && (a.attendanceDate || '').slice(0, 10) === today,
        );
        return (
          <View key={child.studentId} style={{ backgroundColor: '#fffef8', padding: 12, borderRadius: 12, marginBottom: 10 }}>
            <Text style={{ fontWeight: '600' }}>{studentDisplay(child)}</Text>
            <Text>{todayMark?.status || 'Not marked'}</Text>
            {isTeacher ? (
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                {(['present', 'absent', 'makeup'] as const).map((status) => (
                  <Pressable
                    key={status}
                    onPress={() => void mark(child.studentId, status)}
                    style={{ backgroundColor: '#0B3D2E', padding: 8, borderRadius: 8 }}
                  >
                    <Text style={{ color: '#F7F1E1' }}>{status}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
    </ScrollView>
  );
}
