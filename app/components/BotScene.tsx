'use client';

import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import type { BotStateId } from '@/lib/types';

interface BotStateVisual {
  label: string;
  eyeW: string;
  eyeH: string;
  eyeRadius: string;
  eyeColor?: string;
  mouthW: string;
  mouthH: string;
  mouthRadius: string;
  mouthColor?: string;
  waveVisible: boolean;
  waveColor?: string;
  dotColor: string;
  statusText: string;
  eyeAnim: string;
  mouthAnim: string;
}

const STATE_ORDER: BotStateId[] = ['idle', 'listen', 'think', 'speak', 'reveal'];

const STATES: Record<BotStateId, BotStateVisual> = {
  idle: {
    label: '⊙ Idle',
    eyeW: '22px', eyeH: '20px', eyeRadius: '4px',
    mouthW: '28px', mouthH: '6px', mouthRadius: '3px',
    waveVisible: false,
    dotColor: '#c8a55a',
    statusText: 'Idle · Waiting',
    eyeAnim: 'eyeBlink 4s ease-in-out infinite',
    mouthAnim: 'none',
  },
  listen: {
    label: '◉ Listening',
    eyeW: '26px', eyeH: '24px', eyeRadius: '50%', eyeColor: '#1d9e75',
    mouthW: '14px', mouthH: '14px', mouthRadius: '50%', mouthColor: '#1d9e75',
    waveVisible: true, waveColor: '#1d9e75',
    dotColor: '#1d9e75',
    statusText: 'Listening · Recording',
    eyeAnim: 'none',
    mouthAnim: 'none',
  },
  think: {
    label: '⟳ Thinking',
    eyeW: '22px', eyeH: '8px', eyeRadius: '4px', eyeColor: '#7f77dd',
    mouthW: '20px', mouthH: '4px', mouthRadius: '2px', mouthColor: '#7f77dd',
    waveVisible: false,
    dotColor: '#7f77dd',
    statusText: 'Thinking · Processing',
    eyeAnim: 'none',
    mouthAnim: 'none',
  },
  speak: {
    label: '▶ Speaking',
    eyeW: '22px', eyeH: '20px', eyeRadius: '4px',
    mouthW: '32px', mouthH: '10px', mouthRadius: '5px',
    waveVisible: true,
    dotColor: '#378add',
    statusText: 'Speaking · AI Response',
    eyeAnim: 'eyeBlink 2s ease-in-out infinite',
    mouthAnim: 'mouthTalk 0.4s ease-in-out infinite',
  },
  reveal: {
    label: '✦ Reveal',
    eyeW: '28px', eyeH: '28px', eyeRadius: '50%', eyeColor: '#d85a30',
    mouthW: '40px', mouthH: '8px', mouthRadius: '4px', mouthColor: '#d85a30',
    waveVisible: false,
    dotColor: '#d85a30',
    statusText: '✦ Generating your poster',
    eyeAnim: 'revealEye 1s ease-in-out infinite',
    mouthAnim: 'none',
  },
};

const WAVE_BARS: { s: number; delay: string }[] = [
  { s: 1.5, delay: '0s' },
  { s: 3, delay: '0.1s' },
  { s: 4, delay: '0.15s' },
  { s: 2.5, delay: '0.2s' },
  { s: 5, delay: '0.25s' },
  { s: 3.5, delay: '0.3s' },
  { s: 4.5, delay: '0.35s' },
  { s: 2, delay: '0.4s' },
  { s: 3, delay: '0.45s' },
  { s: 4, delay: '0.5s' },
  { s: 1.5, delay: '0.55s' },
  { s: 3.5, delay: '0.6s' },
  { s: 5, delay: '0.65s' },
  { s: 2.5, delay: '0.7s' },
  { s: 3, delay: '0.75s' },
];

const TYPE_INTERVAL_MS = 22;

export interface BotSceneAnswer {
  original: string;
  translation?: string | null;
}

export interface ChatTurn {
  question: string;
  answer: string;
  translation?: string;
}

export interface BotSceneProps {
  state: BotStateId;
  questionLabel?: string;
  questionText: string;
  statusText?: string;
  footerRight?: string;
  answer?: BotSceneAnswer | null;
  chatHistory?: ChatTurn[];
  waveLevel?: number;
  progressCurrent?: number;
  progressTotal?: number;
  children?: ReactNode;
}

export default function BotScene({
  state,
  questionLabel,
  questionText,
  statusText,
  footerRight,
  answer,
  chatHistory,
  waveLevel,
  progressCurrent,
  progressTotal,
  children,
}: BotSceneProps) {
  const [lightMode, setLightMode] = useState(false);
  const [displayedText, setDisplayedText] = useState('');

  const st = STATES[state];

  useEffect(() => {
    const target = questionText || '';
    setDisplayedText('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayedText(target.slice(0, i));
      if (i >= target.length) clearInterval(interval);
    }, TYPE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [questionText]);

  const gold = lightMode ? '#6b4e1a' : '#c8a55a';

  const eyeStyle: CSSProperties = {
    width: st.eyeW,
    height: st.eyeH,
    borderRadius: st.eyeRadius,
    background: st.eyeColor || gold,
    animation: st.eyeAnim,
  };

  const mouthStyle: CSSProperties = {
    width: st.mouthW,
    height: st.mouthH,
    borderRadius: st.mouthRadius,
    background: st.mouthColor || gold,
    animation: st.mouthAnim,
  };

  const waveColor = st.waveColor || gold;
  const waveScale = waveLevel !== undefined ? Math.min(1.6, Math.max(0.4, 1 + waveLevel * 18)) : 1;

  return (
    <div className={`stage ${lightMode ? 'light-mode' : ''}`}>
      <div className="grid-bg" />
      <div
        className="glow-blob"
        style={{ width: 300, height: 300, background: 'rgba(200,165,90,0.04)', top: -80, left: -60, animationDelay: '0s' }}
      />
      <div
        className="glow-blob"
        style={{ width: 200, height: 200, background: 'rgba(127,119,221,0.04)', bottom: -40, right: -40, animationDelay: '3s' }}
      />

      <button className="light-toggle" onClick={() => setLightMode((l) => !l)}>
        {lightMode ? '☽ Dark' : '☀ Light'}
      </button>

      <div className="bot-wrap">
        <div className="bot-shadow" />
        <div className="bot-body">
          <div className="antenna antenna-left">
            <div className="antenna-tip" />
          </div>
          <div className="antenna antenna-right">
            <div className="antenna-tip" style={{ animationDelay: '0.7s' }} />
          </div>
          <div className="ear ear-left" />
          <div className="ear ear-right" />
          <div className="bot-screen">
            <div className="screen-grid" />
            <div className="eyes">
              <div className="eye" style={eyeStyle} />
              <div className="eye" style={eyeStyle} />
            </div>
            <div className="mouth" style={mouthStyle} />
          </div>
          <div className="bot-strip" />
        </div>
      </div>

      <div className="bot-name">sc·ai</div>
      <div className="bot-sub">Star Canvas · Cinema Intelligence</div>

      <div className="state-row">
        {STATE_ORDER.map((id) => (
          <div key={id} className={`state-pill s-${id} ${state === id ? 'active' : ''}`}>
            {STATES[id].label}
          </div>
        ))}
      </div>

      <div
        className={`wave-wrap ${st.waveVisible ? 'visible' : ''}`}
        style={{ transform: `scaleY(${waveScale})` }}
      >
        {WAVE_BARS.map((bar, i) => (
          <div
            key={i}
            className="wbar"
            style={{ '--s': bar.s, animationDelay: bar.delay, background: waveColor } as CSSProperties}
          />
        ))}
      </div>

      {progressTotal !== undefined && progressTotal > 0 && (
        <div className="progress-wrap">
          <div
            className="progress-bar"
            style={{ width: `${Math.min(100, Math.max(0, ((progressCurrent ?? 0) / progressTotal) * 100))}%` }}
          />
          <div className="progress-text">
            {Math.max(0, progressCurrent ?? 0)} / {progressTotal}
          </div>
        </div>
      )}

      {chatHistory && chatHistory.length > 0 && (
        <div className="chat-history">
          {chatHistory.map((turn, i) => (
            <div key={i} className="chat-turn">
              <div className="chat-q">{turn.question}</div>
              <div className="chat-a">{turn.answer}</div>
              {turn.translation && turn.translation !== turn.answer && (
                <div className="chat-a-translation">{turn.translation}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="q-card">
        {questionLabel && <div className="q-label">{questionLabel}</div>}
        <div className="q-text">
          {displayedText}
          <span className="q-cursor" />
        </div>
      </div>

      <div className="status-bar">
        <div className="status-left">
          <div className="status-dot" style={{ background: st.dotColor }} />
          <span className="status-text">{statusText || st.statusText}</span>
        </div>
        {footerRight && <span className="status-right">{footerRight}</span>}
      </div>

      {children && <div className="bot-actions">{children}</div>}
    </div>
  );
}
