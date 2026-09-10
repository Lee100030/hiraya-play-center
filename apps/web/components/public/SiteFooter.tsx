import { publicNav } from '@/lib/nav';
import type { PublicSite } from '@hiraya/types';
import Image from 'next/image';
import Link from 'next/link';

export function SiteFooter({ site }: { site: PublicSite }) {
  return (
    <footer className="site-footer">
      <div className="footer-grid">
        <div>
          <div className="footer-brand">
            <Image src="/images/hiraya-crest.png" alt="" width={40} height={40} />
            <span>HIRAYA</span>
          </div>
          <p>{site.description || 'A safe and supportive place to grow.'}</p>
        </div>
        <div>
          <h3>Explore</h3>
          {publicNav.map((item) => (
            <p key={item.href}>
              <Link href={item.href}>{item.label}</Link>
            </p>
          ))}
        </div>
        <div>
          <h3>Contact</h3>
          {site.address ? <p>{site.address}</p> : null}
          {site.phone ? <p>{site.phone}</p> : null}
          {site.email ? <p>{site.email}</p> : null}
        </div>
      </div>
      <p className="footer-copy">© {new Date().getFullYear()} {site.centerName}</p>
    </footer>
  );
}
