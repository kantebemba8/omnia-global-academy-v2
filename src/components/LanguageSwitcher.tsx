import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { PLATFORM_LANGUAGES, useLanguage } from '../i18n/LanguageContext';

export function LanguageSwitcher({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const { language, setLanguage } = useLanguage();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const activeLanguage = PLATFORM_LANGUAGES.find(item => item.code === language) || PLATFORM_LANGUAGES[0];

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, []);

  return (
    <div ref={rootRef} className={`relative ${className}`} data-no-auto-translate="true">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-[#D7B56D] bg-white px-2.5 py-2 text-xs font-bold text-[#8A5F09] transition hover:bg-[#FFF8E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813]"
        aria-label={`Langue active : ${activeLanguage.label}. Changer de langue`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{activeLanguage.shortLabel}</span>
        {!compact && <span className="hidden sm:inline">{activeLanguage.label}</span>}
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div role="listbox" aria-label="Choisir la langue de la plateforme" className="absolute right-0 top-[calc(100%+8px)] z-[80] w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl">
          {PLATFORM_LANGUAGES.map(option => {
            const selected = option.code === language;
            return (
              <button key={option.code} type="button" role="option" aria-selected={selected} onClick={() => { setLanguage(option.code); setOpen(false); }} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <span className="w-7 text-xs font-bold text-[#8A5F09]">{option.shortLabel}</span>
                <span className="flex-1" dir={option.direction}>{option.label}</span>
                {selected && <Check size={15} className="text-[#BF8813]" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
