'use client';

import type { PublicSite } from '@hiraya/types';
import { facebookHref, isUnsetPublicValue } from '@/lib/publicSite';
import { ClockIcon, FacebookIcon, MailIcon, PhoneIcon, PinIcon } from '@/components/public/icons';
import { FormEvent, ReactNode, useState } from 'react';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [ok, setOk] = useState(false);
  const facebook = facebookHref(site);
  const addressReady = !isUnsetPublicValue(site.address, 'address');
  const phoneReady = !isUnsetPublicValue(site.phone, 'phone');
  const emailReady = !isUnsetPublicValue(site.email, 'email');
  const mapQuery = encodeURIComponent(addressReady ? site.address : '');
  const hours = (site.businessHours || '').trim();

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setOk(false);
    const form = event.currentTarget;
    const data = {
      name: String(new FormData(form).get('name') || '').trim(),
      email: String(new FormData(form).get('email') || '').trim(),
      phone: String(new FormData(form).get('phone') || '').trim(),
      message: String(new FormData(form).get('message') || '').trim(),
    };
    const next: Record<string, string> = {};
    if (data.name.length < 2) next.name = 'Enter your name.';
    if (!emailPattern.test(data.email)) next.email = 'Enter a valid email.';
    if ((data.phone.match(/\d/g) || []).length < 7) next.phone = 'Enter a valid phone number.';
    if (data.message.length < 10) next.message = 'Please write a short message.';
    setErrors(next);
    if (Object.keys(next).length) return;

    const subject = encodeURIComponent(`Website inquiry from ${data.name}`);
    const body = encodeURIComponent(`${data.message}\n\n${data.name}\n${data.email}\n${data.phone}`);
    if (emailReady) {
      window.location.href = `mailto:${site.email}?subject=${subject}&body=${body}`;
    }
    setOk(true);
    form.reset();
  }

  return (
    <section className={standalone ? 'public-inner contact-section' : 'public-section contact-section'} id="contact">
      <header className="section-header">
        <p className="eyebrow">Visit us</p>
        <Heading>Contact</Heading>
        <p>Questions about enrollment, schedules, or your application? Reach the learning center below.</p>
      </header>

      <div className="contact-layout">
        <form className="contact-form" onSubmit={onSubmit} noValidate>
          <label className={errors.name ? 'field-invalid' : undefined}>
            Name
            <input name="name" autoComplete="name" aria-invalid={Boolean(errors.name)} />
            {errors.name ? <span className="field-error">{errors.name}</span> : null}
          </label>
          <label className={errors.email ? 'field-invalid' : undefined}>
            Email
            <input name="email" type="email" autoComplete="email" aria-invalid={Boolean(errors.email)} />
            {errors.email ? <span className="field-error">{errors.email}</span> : null}
          </label>
          <label className={errors.phone ? 'field-invalid' : undefined}>
            Phone
            <input name="phone" type="tel" autoComplete="tel" aria-invalid={Boolean(errors.phone)} />
            {errors.phone ? <span className="field-error">{errors.phone}</span> : null}
          </label>
          <label className={errors.message ? 'field-invalid' : undefined}>
            Message
            <textarea name="message" rows={5} aria-invalid={Boolean(errors.message)} />
            {errors.message ? <span className="field-error">{errors.message}</span> : null}
          </label>
          {ok ? (
            <p className="field-success">
              {emailReady
                ? `Your message is ready. If email did not open, write us at ${site.email}.`
                : 'Your message is ready. Until email is posted, please reach us on Facebook.'}
            </p>
          ) : null}
          <button className="btn-hero" type="submit" data-float-clear>
            Send message
          </button>
        </form>

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
