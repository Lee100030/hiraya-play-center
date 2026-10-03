import type { PublicSite } from '@hiraya/types';
import { facebookHref, isUnsetPublicValue } from '@/lib/publicSite';
import { ClockIcon, FacebookIcon, MailIcon, PhoneIcon, PinIcon } from '@/components/public/icons';
import { ReactNode } from 'react';

function DetailRow({
  icon,
  href,
  children,
  external = false,
}: {
  icon: ReactNode;
  href?: string;
  children: ReactNode;
  external?: boolean;
}) {
  const body = (
    <>
      <span className="detail-icon">{icon}</span>
      <span>{children}</span>
    </>
  );
  if (!href) return <p className="detail-row">{body}</p>;
  return (
    <p className="detail-row">
      <a href={href} target={external ? '_blank' : undefined} rel={external ? 'noreferrer' : undefined}>
        {body}
      </a>
    </p>
  );
}

export function ContactSection({ site, standalone = false }: { site: PublicSite; standalone?: boolean }) {
  const Heading = standalone ? 'h1' : 'h2';
  const facebook = facebookHref(site);
  const addressReady = !isUnsetPublicValue(site.address, 'address');
  const phoneReady = !isUnsetPublicValue(site.phone, 'phone');
  const emailReady = !isUnsetPublicValue(site.email, 'email');
  const mapQuery = encodeURIComponent(addressReady ? site.address : '');
  const hours = (site.businessHours || '').trim();

  return (
    <section className={standalone ? 'public-inner contact-section' : 'public-section contact-section'} id="contact">
      <header className="section-header">
        <p className="eyebrow">Visit us</p>
        <Heading>Contact</Heading>
        <p>Questions about enrollment, schedules, or your application? Reach the learning center below.</p>
      </header>

      <div className="contact-layout">
        <div className="contact-aside">
          <div className="map-embed">
            {addressReady ? (
              <iframe
                title="Hiraya Kids Learning Center location"
                src={`https://maps.google.com/maps?q=${mapQuery}&z=16&hl=en&output=embed`}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="map-fallback" aria-hidden="true" />
            )}
            <div className="map-pin" aria-hidden="true">
              <PinIcon width={36} height={36} />
              <span>HIRAYA</span>
            </div>
          </div>
          <article className="info-card">
            <h3>Center details</h3>
            {addressReady ? (
              <DetailRow icon={<PinIcon />}>{site.address}</DetailRow>
            ) : (
              <DetailRow icon={<PinIcon />}>
                <span className="detail-soon">Campus address coming soon</span>
              </DetailRow>
            )}
            {phoneReady ? (
              <DetailRow icon={<PhoneIcon />} href={`tel:${site.phone}`}>
                {site.phone}
              </DetailRow>
            ) : (
              <DetailRow icon={<PhoneIcon />}>
                <span className="detail-soon">Phone coming soon</span>
              </DetailRow>
            )}
            {emailReady ? (
              <DetailRow icon={<MailIcon />} href={`mailto:${site.email}`}>
                {site.email}
              </DetailRow>
            ) : (
              <DetailRow icon={<MailIcon />}>
                <span className="detail-soon">Email coming soon</span>
              </DetailRow>
            )}
            {hours ? <DetailRow icon={<ClockIcon />}>{hours}</DetailRow> : null}
            <DetailRow icon={<FacebookIcon />} href={facebook} external>
              HIRAYA on Facebook
            </DetailRow>
          </article>
        </div>
      </div>
    </section>
  );
}
