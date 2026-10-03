export const FEEDBACK_LANES = [
  { id: 'teachers', label: 'Teacher feedback' },
  { id: 'parents', label: 'Parent feedback' },
] as const;

export type FeedbackLaneId = (typeof FEEDBACK_LANES)[number]['id'];

export function isFeedbackLane(value?: string | null): value is FeedbackLaneId {
  return FEEDBACK_LANES.some((lane) => lane.id === value);
}

export function parseFeedbackLane(value?: string | null): FeedbackLaneId {
  return isFeedbackLane(value) ? value : 'parents';
}

export function feedbackLaneLabel(value?: string | null) {
  const lane = FEEDBACK_LANES.find((item) => item.id === value);
  return lane?.label || 'Feedback';
}
