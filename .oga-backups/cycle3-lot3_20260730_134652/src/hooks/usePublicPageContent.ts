import { useEffect, useState } from 'react';
import { ENDPOINTS } from '../lib/config';

export type PageContentMap = {
  talent?: {
    badge?: string;
    title?: string;
    subtitle?: string;
    primary_cta?: string;
    secondary_cta?: string;
    recent_talents_title?: string;
    recent_talents_subtitle?: string;
    recent_jobs_title?: string;
    recent_jobs_subtitle?: string;
  };
  omnia_live?: {
    badge?: string;
    title?: string;
    title_accent?: string;
    subtitle?: string;
    primary_cta?: string;
    secondary_cta?: string;
    live_card_title?: string;
    live_card_text?: string;
    training_card_title?: string;
    training_card_text?: string;
    videos_card_title?: string;
    videos_card_text?: string;
    replays_card_title?: string;
    replays_card_text?: string;
  };
};

export function usePublicPageContent() {
  const [content, setContent] = useState<PageContentMap>({});
  useEffect(() => {
    const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
    fetch(ENDPOINTS.siteSettings, { headers: { Authorization: `Bearer ${anon}` } })
      .then(r => r.json())
      .then(d => setContent((d && typeof d.page_content === 'object' && d.page_content) ? d.page_content : {}))
      .catch(() => setContent({}));
  }, []);
  return content;
}
