import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySessionToken } from './session';

export async function getServerAdmin(): Promise<{ adminId: string; email: string } | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  return token ? verifySessionToken(token) : null;
}
