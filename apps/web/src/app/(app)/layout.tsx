import { redirect } from 'next/navigation';
import { getSession } from '@/lib/session';
import { SocketMount } from '@/components/SocketMount';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');
  return (
    <div className="min-h-screen">
      <SocketMount />
      {children}
    </div>
  );
}
