import { ApplyIcon, AssessIcon, VisitIcon, WelcomeIcon } from '@/components/public/icons';
import { Reveal } from '@/components/public/Reveal';
import type { ReactNode } from 'react';

const steps: { n: string; title: string; copy: string; icon: ReactNode }[] = [
  {
    n: '01',
    title: 'Visit',
    copy: 'Walk the campus, meet a teacher, and see how a typical morning feels.',
    icon: <VisitIcon />,
  },
  {
    n: '02',
    title: 'Apply',
    copy: 'Share your child’s details online. Admissions reviews every application personally.',
    icon: <ApplyIcon />,
  },
  {
    n: '03',
    title: 'Assessment',
    copy: 'We look at readiness together — never as a test, always as a conversation.',
    icon: <AssessIcon />,
  },
  {
    n: '04',
    title: 'Welcome',
    copy: 'A gentle first week, with routines explained so home and school stay in step.',
    icon: <WelcomeIcon />,
  },
];

export function EnrollmentPath() {
  return (
    <Reveal>
      <section className="public-section path-section" id="how-enrollment-works">
        <header className="section-header">
          <p className="eyebrow">Admissions</p>
          <h2>How enrollment works</h2>
          <p className="lede">Four clear steps from first visit to the first school-day hug.</p>
        </header>
        <ol className="path-grid">
          {steps.map((step) => (
            <li className="info-card path-card" key={step.n}>
              <span className="path-icon" aria-hidden="true">
                {step.icon}
              </span>
              <span className="path-n">{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </li>
          ))}
        </ol>
      </section>
    </Reveal>
  );
}
