'use client';

import { CalendarOpsBlock } from '@/components/AdminOps';
import { useStore } from '@/components/StoreProvider';
import { Card, Loading } from '@hiraya/ui';

export default function CalendarPage() {
  const { store, loading } = useStore();
  if (loading) return <Loading />;
  return (
    <>
      <h1>Center calendar</h1>
      <CalendarOpsBlock />
      <div className="grid-cards">
        <Card title="Holidays">
          {store.centerHolidays.map((h) => (
            <p key={h.holidayId}>
              {h.date} · {h.title}
            </p>
          ))}
        </Card>
        <Card title="Duties">
          {store.teacherDuties.map((d) => (
            <p key={d.dutyId}>
              {d.workDate} · {d.marker}
            </p>
          ))}
        </Card>
        <Card title="Events">
          {store.schedules
            .filter((s) => s.kind === 'event' || s.kind === 'holiday')
            .map((s) => (
              <p key={s.scheduleId}>
                {s.startAt} · {s.title}
              </p>
            ))}
        </Card>
      </div>
    </>
  );
}
