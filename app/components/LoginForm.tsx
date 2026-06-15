'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

const RESEND_COOLDOWN_SECONDS = 60;

export default function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [stage, setStage] = useState<'email' | 'otp'>('email');
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const sendOtp = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code');
      setStage('otp');
      setCooldown(RESEND_COOLDOWN_SECONDS);
      setTimeout(() => inputsRef.current[0]?.focus(), 50);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async (code: string) => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Invalid code');
      router.push('/admin');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong');
      setDigits(Array(6).fill(''));
      inputsRef.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleDigitChange = (idx: number, value: string) => {
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6 - idx).split('');
      if (!pasted.length) return;
      const next = [...digits];
      pasted.forEach((d, i) => {
        next[idx + i] = d;
      });
      setDigits(next);
      const lastIdx = Math.min(idx + pasted.length, 5);
      inputsRef.current[lastIdx]?.focus();
      if (next.every((d) => d !== '')) {
        verifyOtp(next.join(''));
      }
      return;
    }
    if (!/^[0-9]?$/.test(value)) return;
    const next = [...digits];
    next[idx] = value;
    setDigits(next);
    if (value && idx < 5) {
      inputsRef.current[idx + 1]?.focus();
    }
    if (next.every((d) => d !== '')) {
      verifyOtp(next.join(''));
    }
  };

  const handleKeyDown = (idx: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[idx] && idx > 0) {
      inputsRef.current[idx - 1]?.focus();
    }
  };

  return (
    <div className="q-card login-card">
      {stage === 'email' ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (email) sendOtp();
          }}
        >
          <div className="q-label">Admin Login</div>
          <input
            className="login-input"
            type="email"
            placeholder="you@studio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <button className="login-btn" type="submit" disabled={loading}>
            {loading ? 'Sending…' : 'Send Code'}
          </button>
          {error && <div className="login-error">{error}</div>}
        </form>
      ) : (
        <div>
          <div className="q-label">Enter the 6-digit code sent to {email}</div>
          <div className="otp-row">
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                className="otp-input"
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={d}
                onChange={(e) => handleDigitChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                disabled={loading}
              />
            ))}
          </div>
          {error && <div className="login-error">{error}</div>}
          <button
            className="login-link"
            type="button"
            disabled={cooldown > 0 || loading}
            onClick={sendOtp}
          >
            {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend code'}
          </button>
        </div>
      )}
    </div>
  );
}
