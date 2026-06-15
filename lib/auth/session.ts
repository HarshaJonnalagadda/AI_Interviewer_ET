import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = 'sc_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function sign(payload: string): string {
  return createHmac('sha256', process.env.SESSION_SECRET!).update(payload).digest('hex');
}

export function createSessionToken(adminId: string, email: string): string {
  const exp = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `${adminId}.${email}.${exp}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export function verifySessionToken(token: string): { adminId: string; email: string } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 4) return null;
    const [adminId, email, exp, sig] = parts;
    const expected = sign(`${adminId}.${email}.${exp}`);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    if (Date.now() > Number(exp)) return null;
    return { adminId, email };
  } catch {
    return null;
  }
}
