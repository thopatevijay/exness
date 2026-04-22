import { proxy } from '@/lib/proxy';

export async function GET(req: Request) {
  return proxy(req, '/api/v1/user/me');
}
