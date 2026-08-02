import { useEffect, useRef, useState } from 'react';
import { ENDPOINTS } from '../lib/config';
import { useOmniaNetworkStatus } from './useOmniaNetwork';

interface UseCpdTimerProps {
  lessonId: string | null;
  courseId: string | null;
  requiredSeconds: number;
  initialSpent: number;
  sessionToken: string | null;
  onTimeReached?: () => void;
}

export function useCpdTimer({ lessonId, courseId, requiredSeconds, initialSpent, sessionToken, onTimeReached }: UseCpdTimerProps) {
  const network = useOmniaNetworkStatus();
  const [timeSpent, setTimeSpent] = useState(initialSpent);
  const [isActive, setIsActive] = useState(true);
  const isActiveRef = useRef(true);
  const appActiveRef = useRef(true);
  const lastActivityRef = useRef(Date.now());
  const onTimeReachedRef = useRef(onTimeReached);

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { onTimeReachedRef.current = onTimeReached; }, [onTimeReached]);

  useEffect(() => {
    setTimeSpent(initialSpent);
    setIsActive(true);
    lastActivityRef.current = Date.now();
  }, [lessonId, initialSpent]);

  useEffect(() => {
    const reset = () => {
      lastActivityRef.current = Date.now();
      if (appActiveRef.current && !document.hidden && !isActiveRef.current) setIsActive(true);
    };
    window.addEventListener('mousemove', reset, { passive: true });
    window.addEventListener('keydown', reset, { passive: true });
    window.addEventListener('touchstart', reset, { passive: true });
    window.addEventListener('pointerdown', reset, { passive: true });
    return () => {
      window.removeEventListener('mousemove', reset);
      window.removeEventListener('keydown', reset);
      window.removeEventListener('touchstart', reset);
      window.removeEventListener('pointerdown', reset);
    };
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      const active = appActiveRef.current && !document.hidden;
      setIsActive(active);
      if (active) lastActivityRef.current = Date.now();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, []);

  useEffect(() => {
    const onBlur = () => setIsActive(false);
    const onFocus = () => {
      if (!appActiveRef.current || document.hidden) return;
      setIsActive(true);
      lastActivityRef.current = Date.now();
    };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('blur', onBlur);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  useEffect(() => {
    const onAppState = (event: Event) => {
      const detail = (event as CustomEvent<{ isActive?: boolean }>).detail;
      const active = detail?.isActive !== false;
      appActiveRef.current = active;
      setIsActive(active && !document.hidden);
      if (active) lastActivityRef.current = Date.now();
    };
    window.addEventListener('omnia:app-state', onAppState);
    return () => window.removeEventListener('omnia:app-state', onAppState);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current > 3 * 60 * 1000) setIsActive(false);
    }, 10_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!lessonId) return;
    const id = window.setInterval(() => {
      if (!isActiveRef.current || !appActiveRef.current || document.hidden) return;
      setTimeSpent(previous => {
        const next = previous + 1;
        if (requiredSeconds > 0 && next >= requiredSeconds && previous < requiredSeconds) {
          onTimeReachedRef.current?.();
        }
        return next;
      });
    }, 1_000);
    return () => window.clearInterval(id);
  }, [lessonId, requiredSeconds]);

  useEffect(() => {
    if (!lessonId || !courseId || !sessionToken || !network.connected) return;
    const id = window.setInterval(async () => {
      if (!isActiveRef.current || !appActiveRef.current || document.hidden) return;
      try {
        await fetch(ENDPOINTS.heartbeat, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({
            lesson_id: lessonId,
            course_id: courseId,
            seconds_since_last_heartbeat: 30,
            is_active: true,
          }),
        });
      } catch {
        // Le lecteur conserve localement le temps réalisé hors connexion.
      }
    }, 30_000);
    return () => window.clearInterval(id);
  }, [lessonId, courseId, sessionToken, network.connected]);

  return {
    timeSpent,
    timeRemaining: Math.max(0, requiredSeconds - timeSpent),
    cpdTimeReached: requiredSeconds === 0 || timeSpent >= requiredSeconds,
    isActive,
  };
}
