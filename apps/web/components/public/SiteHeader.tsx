'use client';

import { publicNav } from '@/lib/nav';
import { crestSrc } from '@/lib/publicSite';
import type { PublicSite } from '@hiraya/types';
import { EnrollTrigger } from '@/components/public/enrollment';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

export function SiteHeader({ site }: { site: PublicSite }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const src = crestSrc(site);

  return (
    <header className="site-header">
      <Link href="/" className="site-brand">
        {src.startsWith('/') ? (
          <Image src="/images/hiraya-crest.png" alt="" width={48} height={48} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="" width={48} height={48} />
        )}
        <span>HIRAYA</span>
      </Link>
      <button
        type="button"
        className="site-menu-btn"
        aria-expanded={open}
        aria-controls="public-nav"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? '✕' : '☰'}
      </button>
      <nav id="public-nav" className={open ? 'site-nav open' : 'site-nav'}>
        {publicNav.map((item, index) => (
          <span key={item.href} style={{ display: 'contents' }}>
            {index > 0 ? <span className="nav-dot" aria-hidden="true" /> : null}
            <Link
              href={item.href}
              aria-current={pathname === item.href ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {item.label}
            </Link>
          </span>
        ))}
        <EnrollTrigger className="site-nav-cta" onClick={() => setOpen(false)}>
          Enroll now
        </EnrollTrigger>
      </nav>
      <div className="site-header-end">
        <EnrollTrigger className="btn-hero">Enroll now</EnrollTrigger>
      </div>
    </header>
  );
}
