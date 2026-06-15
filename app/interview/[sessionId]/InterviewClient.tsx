'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import BotScene, { type BotSceneAnswer } from '@/app/components/BotScene';
import VoiceRecorder from '@/app/components/VoiceRecorder';
import type { BotStateId, Language, SessionStatus } from '@/lib/types';

const LANGUAGE_LABELS: Record<Language, string> = { te: 'Telugu', hi: 'Hindi', en: 'English' };

type Phase = 'greeting' | 'loading' | 'speaking' | 'listening' | 'thinking' | 'done' | 'error';

const BOT_STATE: Record<Phase, BotStateId> = {
  greeting: 'idle',
  loading: 'think',
  speaking: 'speak',
  listening: 'listen',
  thinking: 'think',
  done: 'reveal',
  error: 'idle',
};

interface Props {
  sessionId: string;
  status: SessionStatus;
  language: Language;
  filmName: string;
  celebrityName: string;
  sessionTitle: string | null;
  questionCount: number;
  currentTurn: number;
  viewerGreeting: string | null;
  celebrityGreeting: string | null;
  celebrityGreetingTranslation: string | null;
}

export default function InterviewClient(props: Props) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('greeting');
  const [questionText, setQuestionText] = useState(
    props.viewerGreeting || `Welcome to the ${props.filmName} interview with ${props.celebrityName}.`
  );
  const [turnNumber, setTurnNumber] = useState(props.currentTurn || 0);
  const [answer, setAnswer] = useState<BotSceneAnswer | null>(null);
  const [waveLevel, setWaveLevel] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);

  const playAudio = useCallback((audioBase64: string, mimeType: string, onEnded: () => void) => {
    const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);

    try {
      const AudioCtxClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = audioCtxRef.current ?? new AudioCtxClass();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaElementSource(audio);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      analyser.connect(ctx.destination);

      const data = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        setWaveLevel(Math.sqrt(sum / data.length));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch {
      // AnalyserNode unsupported in this browser — audio still plays without live levels
    }

    audio.onended = () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setWaveLevel(0);
      onEnded();
    };

    audio.play().catch(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setWaveLevel(0);
      onEnded();
    });
  }, []);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioCtxRef.current?.close().catch(() => {});
    };
  }, []);

  // Already finished — go straight to the poster reveal
  useEffect(() => {
    if (props.status === 'completed' || props.status === 'poster_generated') {
      router.replace(`/interview/${props.sessionId}/reveal`);
    }
  }, [props.status, props.sessionId, router]);

  const loadCurrentQuestion = useCallback(async () => {
    setPhase('loading');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/interview/question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: props.sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load question');

      setTurnNumber(data.turnNumber);
      setQuestionText(data.questionText);
      if (data.answered) {
        setAnswer({ original: data.answerTranscript, translation: data.answerTranslation });
      }
      setPhase('speaking');
      playAudio(data.audioBase64, data.mimeType, () => setPhase('listening'));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong');
      setPhase('error');
    }
  }, [props.sessionId, playAudio]);

  // Resume an in-progress interview
  useEffect(() => {
    if (props.status !== 'active' && props.status !== 'paused') return;
    loadCurrentQuestion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const beginInterview = useCallback(async () => {
    setPhase('loading');
    setErrorMsg(null);
    try {
      const res = await fetch('/api/interview/begin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: props.sessionId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to begin interview');

      setTurnNumber(data.turnNumber);
      setQuestionText(data.questionText);
      setAnswer(null);
      setPhase('speaking');
      playAudio(data.audioBase64, data.mimeType, () => setPhase('listening'));
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Something went wrong');
      setPhase('error');
    }
  }, [props.sessionId, playAudio]);

  const handleAnswer = useCallback(
    async (audioBase64: string, _mimeType: string, durationSeconds: number) => {
      setPhase('thinking');
      setWaveLevel(0);
      try {
        const res = await fetch('/api/interview/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId: props.sessionId, audioBase64, turnNumber, durationSeconds }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to process answer');

        setAnswer({ original: data.transcript, translation: data.translation });

        if (data.type === 'poster_ready') {
          setQuestionText('Thank you. Your poster is being created now...');
          setPhase('done');
          setTimeout(() => router.push(`/interview/${props.sessionId}/reveal`), 1800);
          return;
        }

        setTurnNumber(data.turnNumber);
        setQuestionText(data.questionText);
        setPhase('speaking');
        playAudio(data.audioBase64, data.mimeType, () => setPhase('listening'));
      } catch (e) {
        setErrorMsg(e instanceof Error ? e.message : 'Something went wrong');
        setPhase('error');
      }
    },
    [props.sessionId, turnNumber, playAudio, router]
  );

  if (props.status === 'completed' || props.status === 'poster_generated') {
    return null;
  }

  const questionLabel =
    turnNumber > 0
      ? `Question ${turnNumber} of ${props.questionCount}`
      : props.sessionTitle || `${props.filmName} · Live Interview`;

  return (
    <BotScene
      state={BOT_STATE[phase]}
      questionLabel={questionLabel}
      questionText={questionText}
      statusText={phase === 'error' ? errorMsg || 'Something went wrong' : undefined}
      footerRight={`${props.filmName} · ${LANGUAGE_LABELS[props.language]}`}
      answer={phase === 'thinking' || phase === 'done' ? answer : null}
      waveLevel={phase === 'speaking' || phase === 'listening' ? waveLevel : undefined}
      progressCurrent={turnNumber}
      progressTotal={props.questionCount}
    >
      {phase === 'greeting' && (
        <>
          {props.celebrityGreeting && (
            <div className="greeting-block">
              <p className="greeting-original">{props.celebrityGreeting}</p>
              {props.celebrityGreetingTranslation && props.language !== 'en' && (
                <p className="greeting-translation">{props.celebrityGreetingTranslation}</p>
              )}
            </div>
          )}
          <button type="button" className="interview-btn" onClick={beginInterview}>
            Begin Interview
          </button>
        </>
      )}

      {phase === 'listening' && <VoiceRecorder active onResult={handleAnswer} onLevel={setWaveLevel} />}

      {phase === 'error' && (
        <button type="button" className="interview-btn" onClick={turnNumber > 0 ? loadCurrentQuestion : beginInterview}>
          Retry
        </button>
      )}
    </BotScene>
  );
}
