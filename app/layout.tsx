import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'Preflight | Roadmap & Feedback',
  description: 'Preflight mission control for feedback and roadmap planning.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang='en'>
      <body>
        <a href='#main-content' className='skip-link'>
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
