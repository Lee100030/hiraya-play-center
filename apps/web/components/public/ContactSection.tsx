import type { PublicSite } from '@hiraya/types';

export function ContactSection({ site }: { site: PublicSite }) {
  return (
    <section className="public-section" id="contact">
      <p className="eyebrow">Visit us</p>
      <h2>Contact</h2>
      <p>Questions about enrollment, schedules, or your application? Reach the learning center using the details below.</p>
      <div className="program-grid">
        <article className="info-card">
          <h3>Address</h3>
          <p>{site.address || 'Ask the center for the campus address.'}</p>
        </article>
        <article className="info-card">
          <h3>Phone</h3>
          {site.phone ? (
            <p>
              <a href={`tel:${site.phone}`}>{site.phone}</a>
            </p>
          ) : (
            <p>Phone number will be posted by the center.</p>
          )}
        </article>
        <article className="info-card">
          <h3>Email</h3>
          {site.email ? (
            <p>
              <a href={`mailto:${site.email}`}>{site.email}</a>
            </p>
          ) : (
            <p>Email will be posted by the center.</p>
          )}
        </article>
        <article className="info-card">
          <h3>Hours</h3>
          <p>{site.businessHours || 'Monday–Friday'}</p>
        </article>
      </div>
    </section>
  );
}
