import { proxy } from '@/lib/proxy';

export async function POST(req: Request) {
  return proxy(req, '/api/v1/user/deposit');
}
