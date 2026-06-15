import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { hashOtp, OTP_MAX_ATTEMPTS } from '@/lib/auth/otp';
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_SECONDS } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  const { email, otp } = await req.json();
  if (!email || !otp) {
    return NextResponse.json({ error: 'Email and code are required' }, { status: 400 });
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const supabase = createServiceClient();

  const { data: admin } = await supabase
    .from('admins')
    .select('id, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!admin) {
    return NextResponse.json({ error: 'Email not found' }, { status: 404 });
  }

  const { data: token } = await supabase
    .from('otp_tokens')
    .select('*')
    .eq('admin_id', admin.id)
    .eq('used', false)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!token) {
    return NextResponse.json({ error: 'No active code. Request a new one.' }, { status: 400 });
  }

  if (new Date(token.expires_at) < new Date()) {
    return NextResponse.json({ error: 'Code expired' }, { status: 400 });
  }

  if (token.attempts >= OTP_MAX_ATTEMPTS) {
    return NextResponse.json({ error: 'Too many attempts. Request a new code.' }, { status: 429 });
  }

  const expectedHash = hashOtp(String(otp).trim(), normalizedEmail);
  if (expectedHash !== token.token_hash) {
    await supabase.from('otp_tokens').update({ attempts: token.attempts + 1 }).eq('id', token.id);
    return NextResponse.json({ error: 'Invalid code' }, { status: 400 });
  }

  await supabase.from('otp_tokens').update({ used: true }).eq('id', token.id);

  const sessionToken = createSessionToken(admin.id, admin.email);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_SECONDS,
  });
  return res;
}
