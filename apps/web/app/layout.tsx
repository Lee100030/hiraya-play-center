import type { Metadata } from 'next';
import './globals.css';
import './public-site.css';

export const metadata: Metadata = {
  title: 'HIRAYA Learning Center',
  description:
    'A safe and supportive learning environment where children can grow, learn, and develop their skills.',
  icons: { icon: '/images/hiraya-crest.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
