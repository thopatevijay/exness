export default function AppLayout({ children }: { children: React.ReactNode }) {
  // Stage 11 will add an auth gate that reads the cookie.
  return <div className="min-h-screen">{children}</div>;
}
