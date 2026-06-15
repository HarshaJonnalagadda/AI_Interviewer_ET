export const SESSION_COOKIE = 'sc_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(process.env.SESSION_SECRET!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Buffer.from(sigBuf).toString('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function createSessionToken(adminId: string, email: string): Promise<string> {
  const exp = Date.now() + SESSION_TTL_SECONDS * 1000;
  const payload = `${adminId}.${email}.${exp}`;
  const sig = await sign(payload);
  return Buffer.from(`${payload}.${sig}`).toString('base64url');
}

export async function verifySessionToken(token: string): Promise<{ adminId: string; email: string } | null> {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const parts = decoded.split('.');
    if (parts.length !== 4) return null;
    const [adminId, email, exp, sig] = parts;
    const expected = await sign(`${adminId}.${email}.${exp}`);
    if (!timingSafeEqualHex(sig, expected)) return null;
    if (Date.now() > Number(exp)) return null;
    return { adminId, email };
  } catch {
    return null;
  }
}
