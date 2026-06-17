'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const VAD_CONFIG = {
  calibrationMs: 1500,      // longer window captures earphone cable transients
  noiseMultiplier: 4.5,     // dynamic threshold = ambient_rms × this
  fallbackRmsThreshold: 0.015, // higher floor for clean mics (earphones)
  minRecordingMs: 2000,     // absolute minimum before any auto-stop
  silenceThresholdMs: 15000, // stop after this much silence post-speech
  maxRecordingMs: 90000,
  peakHoldMs: 500,
  calibrationPercentile: 0.90, // use 90th-percentile of samples, not mean
};

type Props = {
  active: boolean;
  onResult: (audioBase64: string, mimeType: string, durationSeconds: number) => void;
  onLevel?: (level: number) => void;
  onRecordingChange?: (recording: boolean) => void;
};

export default function VoiceRecorder({ active, onResult, onLevel, onRecordingChange }: Props) {
  const [recording, setRecording] = useState(false);
  const [vadPhase, setVadPhase] = useState<'calibrating' | 'waiting' | 'speaking' | 'finishing'>('calibrating');
  const [silenceProgress, setSilenceProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // VAD state — all in refs so the RAF closure sees current values
  const calibrationSamplesRef = useRef<number[]>([]);
  const calibrationDoneRef = useRef(false);
  const dynamicThresholdRef = useRef(VAD_CONFIG.fallbackRmsThreshold);
  const hasSpokeRef = useRef(false);
  const silenceStartRef = useRef<number | null>(null);
  const peakRef = useRef(0);
  const peakTimeRef = useRef(0);
  const silenceProgressRef = useRef(0);

  const stop = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') mr.stop();
  }, []);

  const cleanup = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioCtxRef.current?.close().catch(() => {});
    audioCtxRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;

        const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtxClass();
        audioCtxRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        source.connect(analyser);
        analyserRef.current = analyser;

        const mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';
        const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        const actualMimeType = mediaRecorder.mimeType || mimeType || 'audio/webm';
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
          cleanup();
          setRecording(false);
          onRecordingChange?.(false);
          const blob = new Blob(chunksRef.current, { type: actualMimeType });
          const durationSeconds = (Date.now() - startTimeRef.current) / 1000;
          const arrayBuffer = await blob.arrayBuffer();
          onResult(arrayBufferToBase64(arrayBuffer), actualMimeType, durationSeconds);
        };

        // Reset all VAD state
        calibrationSamplesRef.current = [];
        calibrationDoneRef.current = false;
        dynamicThresholdRef.current = VAD_CONFIG.fallbackRmsThreshold;
        hasSpokeRef.current = false;
        silenceStartRef.current = null;
        peakRef.current = 0;
        peakTimeRef.current = Date.now();
        silenceProgressRef.current = 0;

        startTimeRef.current = Date.now();
        mediaRecorder.start();
        setRecording(true);
        setVadPhase('calibrating');
        setSilenceProgress(0);
        onRecordingChange?.(true);

        const data = new Float32Array(analyser.fftSize);

        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getFloatTimeDomainData(data);

          let sumSquares = 0;
          for (let i = 0; i < data.length; i++) sumSquares += data[i] * data[i];
          const rms = Math.sqrt(sumSquares / data.length);
          const now = Date.now();
          const elapsed = now - startTimeRef.current;

          // Peak hold for waveform display
          if (rms > peakRef.current || now - peakTimeRef.current > VAD_CONFIG.peakHoldMs) {
            peakRef.current = rms;
            peakTimeRef.current = now;
          }
          onLevel?.(peakRef.current);

          // Hard cap
          if (elapsed >= VAD_CONFIG.maxRecordingMs) {
            stop();
            return;
          }

          // Phase 1 — calibration: collect ambient noise samples
          if (!calibrationDoneRef.current) {
            if (elapsed < VAD_CONFIG.calibrationMs) {
              calibrationSamplesRef.current.push(rms);
              rafRef.current = requestAnimationFrame(tick);
              return;
            }
            // Compute dynamic threshold using 90th-percentile of ambient samples.
            // Percentile is more robust than mean for earphone mics where cable
            // handling during calibration creates high transient spikes.
            const samples = calibrationSamplesRef.current.slice().sort((a, b) => a - b);
            const pIdx = Math.floor(samples.length * VAD_CONFIG.calibrationPercentile);
            const ambientP90 = samples.length > 0 ? (samples[pIdx] ?? samples[samples.length - 1]) : 0;
            dynamicThresholdRef.current = Math.max(
              ambientP90 * VAD_CONFIG.noiseMultiplier,
              VAD_CONFIG.fallbackRmsThreshold,
            );
            calibrationDoneRef.current = true;
            setVadPhase('waiting');
          }

          // Phase 2 — VAD active
          const threshold = dynamicThresholdRef.current;
          const isSpeech = rms >= threshold;

          if (isSpeech) {
            hasSpokeRef.current = true;
            silenceStartRef.current = null;  // reset silence timer on speech
            if (silenceProgressRef.current !== 0) {
              silenceProgressRef.current = 0;
              setSilenceProgress(0);
            }
            setVadPhase('speaking');
          } else {
            // Silence — count down whether or not speech has been detected yet
            if (silenceStartRef.current === null) silenceStartRef.current = now;
            const silenceDuration = now - silenceStartRef.current;

            if (elapsed >= VAD_CONFIG.minRecordingMs) {
              const progress = silenceDuration / VAD_CONFIG.silenceThresholdMs;
              const clamped = Math.min(progress, 1);
              if (Math.abs(clamped - silenceProgressRef.current) > 0.02) {
                silenceProgressRef.current = clamped;
                setSilenceProgress(clamped);
              }
              // Show countdown bar early after speech; hold 'waiting' longer before speech
              const finishThreshold = hasSpokeRef.current ? 0.05 : 0.5;
              setVadPhase(
                clamped > finishThreshold ? 'finishing' : hasSpokeRef.current ? 'speaking' : 'waiting'
              );

              if (silenceDuration >= VAD_CONFIG.silenceThresholdMs) {
                stop();
                return;
              }
            }
          }

          rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Microphone access failed');
      }
    }

    start();

    return () => {
      cancelled = true;
      stop();
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  const phaseLabel: Record<typeof vadPhase, string> = {
    calibrating: 'Calibrating…',
    waiting: 'Listening…',
    speaking: 'Speaking…',
    finishing: 'Finishing…',
  };

  const secondsLeft = recording && vadPhase === 'finishing'
    ? Math.ceil((1 - silenceProgress) * VAD_CONFIG.silenceThresholdMs / 1000)
    : null;

  return (
    <div className="voice-recorder">
      {error && <p className="voice-recorder-error">{error}</p>}
      {recording && (
        <>
          <div className="vad-status">
            <span className="vad-label">
              {phaseLabel[vadPhase]}
              {secondsLeft !== null && secondsLeft > 0 && ` ${secondsLeft}s`}
            </span>
          </div>
          {vadPhase === 'finishing' && (
            <div className="vad-countdown-bar" style={{ '--progress': silenceProgress } as React.CSSProperties} />
          )}
        </>
      )}
    </div>
  );
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunkSize)));
  }
  return btoa(binary);
}
