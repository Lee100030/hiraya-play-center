import { publicNav } from '@/lib/nav';
import { facebookHref, isUnsetPublicValue } from '@/lib/publicSite';
import type { PublicSite } from '@hiraya/types';
import Image from 'next/image';
import Link from 'next/link';

export function SiteFooter({ site }: { site: PublicSite }) {
  const facebook = facebookHref(site);
  const address = isUnsetPublicValue(site.address, 'address') ? '' : site.address;
  const phone = isUnsetPublicValue(site.phone, 'phone') ? '' : site.phone;
  const email = isUnsetPublicValue(site.email, 'email') ? '' : site.email;
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div className="footer-column footer-brand-col">
          <div className="footer-brand">
            <Image src="/images/hiraya-crest.png" alt="" width={40} height={40} />
            <span>HIRAYA</span>
          </div>
          <p>{site.description || 'A safe and supportive place to grow.'}</p>
        </div>
        <div className="footer-column">
          <h4>Explore</h4>
          <ul>
            {publicNav.map((item) => (
              <li key={item.href}>
                <Link href={item.href}>{item.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div className="footer-column">
          <h4>Contact</h4>
          <ul>
            {address ? <li>{address}</li> : null}
            {phone ? (
              <li>
                <a href={`tel:${phone}`}>{phone}</a>
              </li>
            ) : null}
            {email ? (
              <li>
                <a href={`mailto:${email}`}>{email}</a>
              </li>
            ) : null}
            <li>
              <a href={facebook} target="_blank" rel="noreferrer">
                Facebook
              </a>
            </li>
          </ul>
        </div>
      </div>
      <p className="footer-copy">© {new Date().getFullYear()} {site.centerName}</p>
    </footer>
  );
}
