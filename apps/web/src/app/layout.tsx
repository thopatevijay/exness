import './globals.css';
import { Providers } from '@/components/providers';

export const metadata = {
  title: 'Exness Clone',
  description: 'CFD trading platform — V0',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
