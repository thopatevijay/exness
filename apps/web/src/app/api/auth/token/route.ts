import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Returns the JWT to the browser so it can be put in the WS URL query param.
// The httpOnly cookie can't be read by JS — this server-only route exposes it
// safely to the client, only after the user is signed in (401 otherwise).
// Trade-off: mitigates the httpOnly protection for the lifetime of the WS.
// V1 would proxy the WS through Next itself and avoid exposing the token.
export async function GET(): Promise<NextResponse> {
  const c = await cookies();
  const token = c.get('token')?.value;
  if (!token) return NextResponse.json({ token: null }, { status: 401 });
  return NextResponse.json({ token });
}
