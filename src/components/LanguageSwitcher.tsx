import { Languages } from 'lucide-react';
import { useLanguage } from '../i18n/LanguageContext';

export function LanguageSwitcher({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const { language, toggleLanguage } = useLanguage();
  return (
    <button
      type="button"
      onClick={toggleLanguage}
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#D7B56D] bg-white px-2.5 py-2 text-xs font-bold text-[#8A5F09] transition hover:bg-[#FFF8E8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#BF8813] ${className}`}
      aria-label={language === 'fr' ? 'Switch platform to English' : 'Afficher la plateforme en français'}
      title={language === 'fr' ? 'Switch platform to English' : 'Afficher la plateforme en français'}
    >
      <Languages size={15} aria-hidden="true" />
      <span>{language === 'fr' ? 'FR' : 'EN'}</span>
      {!compact && <span className="hidden xl:inline">→ {language === 'fr' ? 'English' : 'Français'}</span>}
    </button>
  );
}
