import { useEffect, useRef, useState } from 'react';

export type JaasMeetingAccess = {
  type: 'jaas';
  domain: '8x8.vc';
  app_id: string;
  room_name: string;
  jwt: string;
  expires_at: string;
};

type JitsiExternalApiInstance = {
  dispose: () => void;
};

type JitsiExternalApiConstructor = new (
  domain: string,
  options: {
    roomName: string;
    jwt: string;
    parentNode: HTMLElement;
    width?: string | number;
    height?: string | number;
    configOverwrite?: Record<string, unknown>;
  },
) => JitsiExternalApiInstance;

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiExternalApiConstructor;
  }
}

const scriptLoads = new Map<string, Promise<void>>();

function loadJaasScript(appId: string): Promise<void> {
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  const existing = scriptLoads.get(appId);
  if (existing) return existing;

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = `https://8x8.vc/${encodeURIComponent(appId)}/external_api.js`;
    script.async = true;
    script.onload = () => window.JitsiMeetExternalAPI ? resolve() : reject(new Error('JAAS_API_UNAVAILABLE'));
    script.onerror = () => reject(new Error('JAAS_SCRIPT_LOAD_FAILED'));
    document.head.appendChild(script);
  }).catch((error) => {
    scriptLoads.delete(appId);
    throw error;
  });
  scriptLoads.set(appId, promise);
  return promise;
}

export default function JaasMeetingFrame({ meeting, className = 'h-[76vh] w-full' }: { meeting: JaasMeetingAccess; className?: string }) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    let api: JitsiExternalApiInstance | null = null;

    void loadJaasScript(meeting.app_id).then(() => {
      if (disposed || !parentRef.current || !window.JitsiMeetExternalAPI) return;
      api = new window.JitsiMeetExternalAPI('8x8.vc', {
        roomName: `${meeting.app_id}/${meeting.room_name}`,
        jwt: meeting.jwt,
        parentNode: parentRef.current,
        width: '100%',
        height: '100%',
        configOverwrite: {
          prejoinPageEnabled: true,
        },
      });
    }).catch((reason: unknown) => {
      if (!disposed) setError(reason instanceof Error ? reason.message : 'JAAS_UNAVAILABLE');
    });

    return () => {
      disposed = true;
      api?.dispose();
      if (parentRef.current) parentRef.current.innerHTML = '';
    };
  }, [meeting.app_id, meeting.jwt, meeting.room_name]);

  if (error) {
    return <div className={`${className} flex items-center justify-center p-6 text-center text-white`}>La salle vidéo sécurisée est temporairement indisponible.</div>;
  }
  return <div ref={parentRef} className={className} />;
}
