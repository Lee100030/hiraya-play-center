import type { Metadata } from 'next';
import './globals.css';
import './public-site.css';

export const metadata: Metadata = {
  title: 'Hiraya Kids Learning Center',
  description:
    'Growing minds. Building futures. A safe preschool and learning center where children grow, learn, and thrive.',
  icons: { icon: '/images/hiraya-crest.png' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
