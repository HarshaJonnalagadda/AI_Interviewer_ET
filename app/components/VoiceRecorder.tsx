'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Per PRD 7.4 voice activity detection configuration
const VAD_CONFIG = {
  silenceThresholdMs: 2500,
  minRecordingMs: 3000,
  maxRecordingMs: 90000,
  rmsThreshold: 0.008,
  peakHoldMs: 800,
};

type Props = {
  active: boolean;
  onResult: (audioBase64: string, mimeType: string, durationSeconds: number) => void;
  onLevel?: (level: number) => void;
  onRecordingChange?: (recording: boolean) => void;
};

export default function VoiceRecorder({ active, onResult, onLevel, onRecordingChange }: Props) {
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const silenceStartRef = useRef<number | null>(null);
  const peakRef = useRef<number>(0);
  const peakTimeRef = useRef<number>(0);

  const stop = useCallback(() => {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== 'inactive') {
      mr.stop();
    }
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
          const base64 = arrayBufferToBase64(arrayBuffer);
          onResult(base64, actualMimeType, durationSeconds);
        };

        startTimeRef.current = Date.now();
        silenceStartRef.current = null;
        peakRef.current = 0;
        peakTimeRef.current = Date.now();

        mediaRecorder.start();
        setRecording(true);
        onRecordingChange?.(true);

        const data = new Float32Array(analyser.fftSize);

        const tick = () => {
          if (!analyserRef.current) return;
          analyserRef.current.getFloatTimeDomainData(data);

          let sumSquares = 0;
          for (let i = 0; i < data.length; i++) sumSquares += data[i] * data[i];
          const rms = Math.sqrt(sumSquares / data.length);

          const now = Date.now();
          if (rms > peakRef.current || now - peakTimeRef.current > VAD_CONFIG.peakHoldMs) {
            peakRef.current = rms;
            peakTimeRef.current = now;
          }
          onLevel?.(peakRef.current);

          const elapsed = now - startTimeRef.current;

          if (rms < VAD_CONFIG.rmsThreshold) {
            if (silenceStartRef.current === null) silenceStartRef.current = now;
          } else {
            silenceStartRef.current = null;
          }

          const silenceDuration = silenceStartRef.current ? now - silenceStartRef.current : 0;

          if (elapsed >= VAD_CONFIG.maxRecordingMs) {
            stop();
            return;
          }

          if (elapsed >= VAD_CONFIG.minRecordingMs && silenceDuration >= VAD_CONFIG.silenceThresholdMs) {
            stop();
            return;
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

  return (
    <div className="voice-recorder">
      {error && <p className="voice-recorder-error">{error}</p>}
      {recording && (
        <button type="button" className="voice-recorder-done" onClick={stop}>
          Done answering
        </button>
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
