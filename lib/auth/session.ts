export const SESSION_COOKIE = 'sc_session';
export const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function bytesToBase64Url(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
  const str = atob(padded);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(process.env.SESSION_SECRET!),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return bytesToHex(new Uint8Array(sigBuf));
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
  return bytesToBase64Url(new TextEncoder().encode(`${payload}.${sig}`));
}

export async function verifySessionToken(token: string): Promise<{ adminId: string; email: string } | null> {
  try {
    const decoded = new TextDecoder().decode(base64UrlToBytes(token));
    const parts = decoded.split('.');
    if (parts.length < 4) {
      console.error('[session] bad parts count', parts.length, decoded);
      return null;
    }
    const adminId = parts[0];
    const sig = parts[parts.length - 1];
    const exp = parts[parts.length - 2];
    const email = parts.slice(1, -2).join('.');
    const expected = await sign(`${adminId}.${email}.${exp}`);
    if (!timingSafeEqualHex(sig, expected)) return null;
    if (Date.now() > Number(exp)) return null;
    return { adminId, email };
  } catch {
    return null;
  }
}
