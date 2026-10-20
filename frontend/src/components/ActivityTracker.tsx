import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

function getSessionId() {
  const key = 'jfc_activity_session_id';
  let id = sessionStorage.getItem(key);
  if (!id) {
    id = `${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`;
    sessionStorage.setItem(key, id);
  }
  return id;
}

export default function ActivityTracker() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const activityId = useRef<string | null>(null);
  const startedAt = useRef<number>(Date.now());
  const visibleStartedAt = useRef<number>(document.visibilityState === 'visible' ? Date.now() : 0);
  const accumulatedMs = useRef<number>(0);

  useEffect(() => {
    if (loading || !user) return undefined;
    let cancelled = false;
    const path = location.pathname + location.search;
    const sessionId = getSessionId();
    startedAt.current = Date.now();
    accumulatedMs.current = 0;
    visibleStartedAt.current = document.visibilityState === 'visible' ? Date.now() : 0;
    activityId.current = null;

    client.post('/activity-tracking/page-view', {
      path,
      title: document.title,
      sessionId,
      referrer: document.referrer || '',
    }).then((res) => {
      if (!cancelled) activityId.current = res.data?.data?.id || null;
    }).catch(() => {});

    return () => {
      cancelled = true;
      if (visibleStartedAt.current) {
        accumulatedMs.current += Date.now() - visibleStartedAt.current;
        visibleStartedAt.current = 0;
      }
      const id = activityId.current;
      if (id) {
        client.post('/activity-tracking/page-view/heartbeat', {
          activityId: id,
          durationMs: accumulatedMs.current,
          visibility: document.visibilityState,
        }).catch(() => {});
      }
    };
  }, [location.pathname, location.search]);

  useEffect(() => {
    if (loading || !user) return undefined;
    const report = (source: string, message: string, stack = '') => {
      const sessionId = sessionStorage.getItem('jfc_activity_session_id') || '';
      client.post('/activity-tracking/error', {
        path: window.location.pathname + window.location.search,
        sessionId,
        source,
        message,
        stack,
        userAgent: navigator.userAgent,
      }).catch(() => {});
    };
    const onError = (event: ErrorEvent) => report('runtime', event.message || 'Runtime error', event.error?.stack || '');
    const onRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      report('unhandled-rejection', reason?.message || String(reason || 'Unhandled promise rejection'), reason?.stack || '');
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);
    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [loading, user]);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        visibleStartedAt.current = Date.now();
      } else if (visibleStartedAt.current) {
        accumulatedMs.current += Date.now() - visibleStartedAt.current;
        visibleStartedAt.current = 0;
      }
    };
    const onHeartbeat = () => {
      const id = activityId.current;
      if (!id) return;
      let duration = accumulatedMs.current;
      if (visibleStartedAt.current) duration += Date.now() - visibleStartedAt.current;
      client.post('/activity-tracking/page-view/heartbeat', {
        activityId: id,
        durationMs: Math.max(0, Math.round(duration)),
        visibility: document.visibilityState,
      }).catch(() => {});
    };
    document.addEventListener('visibilitychange', onVisibility);
    const timer = window.setInterval(onHeartbeat, 15000);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.clearInterval(timer);
    };
  }, [location.pathname, location.search]);

  return null;
}
