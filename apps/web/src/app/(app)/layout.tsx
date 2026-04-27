import { getSession } from '@/lib/session';
import { SessionProvider } from '@/components/SessionProvider';
import { SocketMount } from '@/components/SocketMount';


export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="min-h-screen">
      <SessionProvider authed={session !== null}>
        <SocketMount />
        {children}
      </SessionProvider>
    </div>
  );
}
