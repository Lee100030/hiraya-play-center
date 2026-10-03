export const PAYMENT_LANES = [
  { id: 'teachers', label: 'Teachers payment' },
  { id: 'students', label: 'Student balance' },
] as const;

export type PaymentLaneId = (typeof PAYMENT_LANES)[number]['id'];

export function isPaymentLane(value?: string | null): value is PaymentLaneId {
  return PAYMENT_LANES.some((lane) => lane.id === value);
}

export function parsePaymentLane(value?: string | null): PaymentLaneId {
  return isPaymentLane(value) ? value : 'students';
}

export function paymentLaneLabel(value?: string | null) {
  const lane = PAYMENT_LANES.find((item) => item.id === value);
  return lane?.label || 'Payments';
}

/** Stored on Payment.enrollmentId so teacher pay rows stay apart from student charges. */
export const TEACHER_PAYMENT_MARK = 'teacher';

export function isTeacherPayment(row: { enrollmentId?: string | null }) {
  return (row.enrollmentId || '').trim().toLowerCase() === TEACHER_PAYMENT_MARK;
}
