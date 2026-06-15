import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth/session';

export default function Home() {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const session = token ? verifySessionToken(token) : null;

  redirect(session ? '/admin' : '/login');
}
