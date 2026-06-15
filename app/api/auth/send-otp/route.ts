import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { createServiceClient } from '@/lib/supabase/service';
import { generateOtp, hashOtp, OTP_TTL_MINUTES } from '@/lib/auth/otp';

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const supabase = createServiceClient();

  let { data: admin } = await supabase
    .from('admins')
    .select('id, email')
    .eq('email', normalizedEmail)
    .maybeSingle();

  if (!admin) {
    const { data: created, error } = await supabase
      .from('admins')
      .insert({ email: normalizedEmail })
      .select('id, email')
      .single();
    if (error) {
      return NextResponse.json({ error: 'Could not create admin account' }, { status: 500 });
    }
    admin = created;
  }

  const otp = generateOtp();
  const tokenHash = hashOtp(otp, normalizedEmail);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000).toISOString();

  const { error: insertError } = await supabase.from('otp_tokens').insert({
    admin_id: admin.id,
    token_hash: tokenHash,
    expires_at: expiresAt,
  });

  if (insertError) {
    return NextResponse.json({ error: 'Could not create OTP' }, { status: 500 });
  }

  if (process.env.RESEND_API_KEY) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.OTP_FROM_EMAIL || 'StarCanvas <onboarding@resend.dev>',
      to: normalizedEmail,
      subject: `${otp} is your StarCanvas login code`,
      text: `Your StarCanvas login code is ${otp}. It expires in ${OTP_TTL_MINUTES} minutes.`,
    });
  } else {
    // No email provider configured — log so local/dev login still works.
    console.log(`[StarCanvas] OTP for ${normalizedEmail}: ${otp}`);
  }

  return NextResponse.json({ ok: true });
}
