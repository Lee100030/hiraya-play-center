export function HiringSection() {
  return (
    <section className="public-section" id="hiring">
      <p className="eyebrow">Careers</p>
      <h2>Teacher hiring</h2>
      <p>
        Hiraya Learning Center welcomes licensed and aspiring early-childhood teachers, ABA therapists, and tutorial
        specialists. Send a letter of intent and resume to the center — we will contact shortlisted applicants.
      </p>
      <div className="program-grid">
        <article className="hlc-card">
          <h3>Playgroup &amp; Pre-school</h3>
          <p>Kinder, Nursery, and Grade 1–3 classroom teachers.</p>
        </article>
        <article className="hlc-card">
          <h3>ABA Therapy</h3>
          <p>Session therapists who can log attendance and notes for admin review.</p>
        </article>
        <article className="hlc-card">
          <h3>Tutorial Session</h3>
          <p>Subject coaches for after-class support.</p>
        </article>
      </div>
      <p>
        Email <a href="mailto:hello@hiraya.local">hello@hiraya.local</a> with the subject line “Teacher application”.
      </p>
    </section>
  );
}
