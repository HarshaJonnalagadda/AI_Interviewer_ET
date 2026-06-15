import { NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from './session';

export function getAdminId(req: NextRequest): string | null {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionToken(token) : null;
  return session?.adminId ?? null;
}
