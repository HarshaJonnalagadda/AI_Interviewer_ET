import { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './session';

export async function getAdminId(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;
  return session?.adminId ?? null;
}
