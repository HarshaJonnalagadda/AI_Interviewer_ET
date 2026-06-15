import { createHash, randomInt } from 'crypto';

export const OTP_TTL_MINUTES = 10;
export const OTP_MAX_ATTEMPTS = 3;

export function generateOtp(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashOtp(otp: string, email: string): string {
  return createHash('sha256').update(`${email.toLowerCase()}:${otp}:${process.env.SESSION_SECRET}`).digest('hex');
}
