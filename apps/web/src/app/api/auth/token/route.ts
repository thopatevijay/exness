import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Returns the JWT to the browser so it can be put in the WS URL query param.

// V1 would proxy the WS through Next itself and avoid exposing the token.
export async function GET(): Promise<NextResponse> {
  const c = await cookies();
  const token = c.get('token')?.value ?? null;
  return NextResponse.json({ token });
}
