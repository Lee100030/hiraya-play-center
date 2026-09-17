import { EnrollTrigger } from '@/components/public/enrollment';

export function EnrollmentCta({ message }: { message: string }) {
  return (
    <section className="enroll-band">
      <h2>Ready to begin your child’s&nbsp;journey?</h2>
      <p>{message}</p>
      <EnrollTrigger className="btn-hero">Start enrollment</EnrollTrigger>
    </section>
  );
}
