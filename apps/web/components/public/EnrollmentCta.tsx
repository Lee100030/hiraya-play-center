import { EnrollTrigger, TeacherApplyTrigger } from '@/components/public/enrollment';

export function EnrollmentCta({ message }: { message: string }) {
  return (
    <section className="enroll-band">
      <h2>Ready to begin your child’s&nbsp;journey?</h2>
      <p>{message}</p>
      <div className="hero-cta-row">
        <EnrollTrigger className="btn-hero">Begin enrollment today</EnrollTrigger>
        <TeacherApplyTrigger className="btn-ghost-light">Apply to teach</TeacherApplyTrigger>
      </div>
    </section>
  );
}
