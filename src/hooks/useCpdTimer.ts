import { useState, useEffect, useRef } from 'react';
import { ENDPOINTS } from '../lib/config';

interface UseCpdTimerProps {
  lessonId: string | null;
  courseId: string | null;
  requiredSeconds: number;
  initialSpent: number;
  sessionToken: string | null;
  onTimeReached?: () => void;
}

export function useCpdTimer({ lessonId, courseId, requiredSeconds, initialSpent, sessionToken, onTimeReached }: UseCpdTimerProps) {
  const [timeSpent, setTimeSpent] = useState(initialSpent);
  const [isActive, setIsActive] = useState(true);
  const isActiveRef = useRef(true);
  const lastActivityRef = useRef(Date.now());
  const onTimeReachedRef = useRef(onTimeReached);

  useEffect(() => { isActiveRef.current = isActive; }, [isActive]);
  useEffect(() => { onTimeReachedRef.current = onTimeReached; }, [onTimeReached]);

  // Reset when lesson changes
  useEffect(() => {
    setTimeSpent(initialSpent);
    setIsActive(true);
    lastActivityRef.current = Date.now();
  }, [lessonId, initialSpent]);

  // Activity detection
  useEffect(() => {
    const reset = () => { lastActivityRef.current = Date.now(); if (!isActiveRef.current) setIsActive(true); };
    window.addEventListener('mousemove', reset, { passive: true });
    window.addEventListener('keydown', reset, { passive: true });
    window.addEventListener('touchstart', reset, { passive: true });
    return () => { window.removeEventListener('mousemove', reset); window.removeEventListener('keydown', reset); window.removeEventListener('touchstart', reset); };
  }, []);

  // Page Visibility API
  useEffect(() => {
    const onVis = () => setIsActive(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Window focus / blur
  useEffect(() => {
    const onBlur = () => setIsActive(false);
    const onFocus = () => { setIsActive(true); lastActivityRef.current = Date.now(); };
    window.addEventListener('blur', onBlur);
    window.addEventListener('focus', onFocus);
    return () => { window.removeEventListener('blur', onBlur); window.removeEventListener('focus', onFocus); };
  }, []);

  // Inactivity check — pause after 3 min of no interaction
  useEffect(() => {
    const id = window.setInterval(() => { if (Date.now() - lastActivityRef.current > 3 * 60 * 1000) setIsActive(false); }, 10_000);
    return () => clearInterval(id);
  }, []);

  // 1-second local tick
  useEffect(() => {
    if (!lessonId) return;
    const id = window.setInterval(() => {
      if (!isActiveRef.current) return;
      setTimeSpent(prev => {
        const next = prev + 1;
        if (requiredSeconds > 0 && next >= requiredSeconds && prev < requiredSeconds) onTimeReachedRef.current?.();
        return next;
      });
    }, 1_000);
    return () => clearInterval(id);
  }, [lessonId, requiredSeconds]);

  // Server heartbeat every 30s
  useEffect(() => {
    if (!lessonId || !courseId || !sessionToken) return;
    const id = window.setInterval(async () => {
      try {
        await fetch(ENDPOINTS.heartbeat, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${sessionToken}` },
          body: JSON.stringify({ lesson_id: lessonId, course_id: courseId, seconds_since_last_heartbeat: 30, is_active: isActiveRef.current }),
        });
      } catch { /* ignore */ }
    }, 30_000);
    return () => clearInterval(id);
  }, [lessonId, courseId, sessionToken]);

  return {
    timeSpent,
    timeRemaining: Math.max(0, requiredSeconds - timeSpent),
    cpdTimeReached: requiredSeconds === 0 || timeSpent >= requiredSeconds,
    isActive,
  };
}
