import { proxy } from '@/lib/proxy';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return proxy(req, `/api/v1/trade/${id}/modify`);
}
