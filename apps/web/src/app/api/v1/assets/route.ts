import { proxy } from '@/lib/proxy';

export async function GET(req: Request) {
  // Public endpoint — no auth
  return proxy(req, '/api/v1/assets', { auth: false });
}
