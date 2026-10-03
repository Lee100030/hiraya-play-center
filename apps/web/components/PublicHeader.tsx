'use client';

import { publicNav } from '@/lib/nav';
import Link from 'next/link';

export function PublicHeader() {
  return (
    <header className="public-nav">
      <Link href="/" className="brand-mark">
        Hiraya Kids Learning Center
      </Link>
      <nav className="public-links">
        {publicNav.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
        <Link href="/login" className="hlc-btn hlc-btn-primary">
          Sign in
        </Link>
      </nav>
    </header>
  );
}
