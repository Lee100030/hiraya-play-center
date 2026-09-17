import { Reveal } from '@/components/public/Reveal';
import { CAMPUS_PHOTOS } from '@/lib/campus';
import Image from 'next/image';

export function CampusMoments() {
  return (
    <Reveal>
      <section className="public-section campus-section">
        <header className="section-header">
          <p className="eyebrow">Our venue</p>
          <h2>HIRAYA Play Center, as it&nbsp;is</h2>
          <p className="lede">Classrooms, the indoor play yard, and the Hiraya Tree court — photographed on campus.</p>
        </header>
        <div className="campus-grid">
          {CAMPUS_PHOTOS.map((item) => (
            <figure className="campus-card" key={item.src}>
              <div className="campus-photo">
                <Image src={item.src} alt={item.title} width={900} height={560} sizes="(max-width: 768px) 100vw, 50vw" />
              </div>
              <figcaption>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
    </Reveal>
  );
}
