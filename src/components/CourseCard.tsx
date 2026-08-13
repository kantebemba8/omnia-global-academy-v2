import { Link } from 'react-router-dom';
import { BookOpen, ExternalLink, LockKeyhole, LogIn } from 'lucide-react';

export interface CourseCardData {
  id: string;
  title: string;
  short_description?: string | null;
  cover_image_url?: string | null;
  category?: string | null;
  level: string;
  price_xof: number;
  is_free: boolean;
  cpd_hours?: number;
  cpd_accredited?: boolean;
  average_rating: number;
  total_reviews: number;
  total_students?: number;
  creator_type?: string;
  language?: string;
  creator_name?: string | null;
  content_origin?: 'internal' | 'external';
  provider_name?: string | null;
  access_mode?: 'public' | 'registered' | 'premium' | 'paid';
  certificate_available?: boolean;
  duration_label?: string | null;
  external_click_count?: number;
}

const LEVEL_COLORS: Record<string, string> = {
  Débutant: '#1E7A52',
  Intermédiaire: '#F59E0B',
  Avancé: '#DC2626',
  Expert: '#7C3AED',
};

function Stars({ rating }: { rating: number }) {
  const normalizedRating = Number.isFinite(rating) ? Math.min(5, Math.max(0, rating)) : 0;
  const roundedRating = Math.round(normalizedRating);
  return (
    <span
      aria-label={`Note : ${normalizedRating.toFixed(1)} sur 5`}
      style={{ color: '#BF8813', fontSize: '13px', letterSpacing: '1px' }}
    >
      <span aria-hidden="true">{'★'.repeat(roundedRating)}{'☆'.repeat(5 - roundedRating)}</span>
    </span>
  );
}

interface CourseCardProps {
  course: CourseCardData;
  variant?: 'grid' | 'list';
}

export function CourseCard({ course, variant = 'grid' }: CourseCardProps) {
  const levelColor = LEVEL_COLORS[course.level] ?? '#6B7280';
  const isExternal = course.content_origin === 'external';
  const coursePath = isExternal ? `/formation-externe/${course.id}` : `/cours/${course.id}`;
  const rating = Number.isFinite(course.average_rating) ? course.average_rating : 0;
  const creatorName = isExternal ? course.provider_name : course.creator_name;
  const accessLabel = course.access_mode === 'registered' ? 'Après inscription' : course.access_mode === 'premium' ? 'Accès Premium' : course.access_mode === 'paid' ? 'Paiement sur Omnia' : 'Accès public';
  const externalPriceLabel = course.access_mode === 'paid' ? `${Number(course.price_xof || 0).toLocaleString('fr-FR')} XOF` : accessLabel;

  if (variant === 'list') {
    return (
      <Link
        to={coursePath}
        aria-label={`Voir la formation ${course.title}`}
        className="flex gap-4 overflow-hidden rounded-xl transition-shadow hover:shadow-md focus-visible:shadow-md"
        style={{ border: '1px solid #E4E7EC', backgroundColor: '#FFFFFF' }}
      >
        <div className="relative w-32 flex-shrink-0 sm:w-40" style={{ backgroundColor: '#F8F9FA' }}>
          {course.cover_image_url ? (
            <img src={course.cover_image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" style={{ minHeight: '100px' }} />
          ) : (
            <div className="flex h-full w-full items-center justify-center" style={{ minHeight: '100px' }}><BookOpen size={24} aria-hidden="true" style={{ color: '#BF8813' }} /></div>
          )}
        </div>
        <div className="min-w-0 flex-1 py-3 pr-2 sm:pr-4">
          <p data-no-auto-translate="true" className="mb-1 text-xs uppercase tracking-wide" style={{ color: '#6B7280' }}>{course.category}</p>
          <p data-no-auto-translate="true" className="mb-1 line-clamp-2 text-sm font-semibold" style={{ color: '#002050' }}>{course.title}</p>
          {creatorName && <p className="mb-1 text-xs" style={{ color: '#6B7280' }}>{isExternal ? 'Source :' : 'Par'} <span data-no-auto-translate="true">{creatorName}</span></p>}
          {course.total_reviews > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <Stars rating={rating} />
              <span className="text-xs font-bold" style={{ color: '#002050' }}>{rating.toFixed(1)}</span>
              <span className="text-xs" style={{ color: '#6B7280' }}>({course.total_reviews})</span>
            </div>
          )}
          <p className="mt-2 text-sm font-bold sm:hidden" style={{ color: isExternal ? '#002050' : course.is_free ? '#1E7A52' : '#002050' }}>
            {isExternal ? externalPriceLabel : course.is_free ? 'Gratuit' : `${course.price_xof.toLocaleString('fr-FR')} XOF`}
          </p>
        </div>
        <div className="hidden flex-shrink-0 flex-col justify-center pr-4 text-right sm:flex">
          <span className="font-bold" style={{ color: isExternal ? '#002050' : course.is_free ? '#1E7A52' : '#002050', fontSize: '15px' }}>
            {isExternal ? externalPriceLabel : course.is_free ? 'Gratuit' : `${course.price_xof.toLocaleString('fr-FR')} XOF`}
          </span>
          {isExternal && (course.external_click_count ?? 0) > 0 ? (
            <span className="text-xs" style={{ color: '#6B7280' }}>{course.external_click_count?.toLocaleString('fr-FR')} visites</span>
          ) : (course.total_students ?? 0) > 0 ? (
            <span className="text-xs" style={{ color: '#6B7280' }}>{course.total_students?.toLocaleString('fr-FR')} apprenants</span>
          ) : null}
        </div>
      </Link>
    );
  }

  return (
    <Link
      to={coursePath}
      aria-label={`Voir la formation ${course.title}`}
      className="flex flex-col overflow-hidden rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg focus-visible:-translate-y-0.5 focus-visible:shadow-lg"
      style={{ border: '1px solid #E4E7EC', backgroundColor: '#FFFFFF' }}
    >
      <div className="relative flex-shrink-0 overflow-hidden" style={{ aspectRatio: '16/9', backgroundColor: '#F8F9FA' }}>
        {course.cover_image_url ? (
          <img src={course.cover_image_url} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center"><BookOpen size={32} aria-hidden="true" style={{ color: '#BF8813' }} /></div>
        )}
        <span className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-xs font-semibold text-white" style={{ backgroundColor: levelColor }}>
          {course.level}
        </span>
        {course.cpd_accredited && (
          <span className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: '#BF8813', color: '#FFF' }}>Certifiée</span>
        )}
        {isExternal && (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs font-bold shadow" style={{ color: '#002050' }}><ExternalLink size={12} />Externe</span>
        )}
        {!isExternal && course.is_free && (
          <span className="absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-xs font-bold" style={{ backgroundColor: '#1E7A52', color: '#FFF' }}>GRATUIT</span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p data-no-auto-translate="true" className="mb-1 text-xs uppercase tracking-wide" style={{ color: '#6B7280' }}>{course.category ?? ''}</p>
        <p data-no-auto-translate="true" className="mb-1 line-clamp-2 flex-1 text-sm font-semibold leading-snug" style={{ color: '#002050' }}>{course.title}</p>
        {creatorName && <p className="mb-2 text-xs" style={{ color: '#6B7280' }}>{isExternal ? 'Source :' : 'Par'} <span data-no-auto-translate="true">{creatorName}</span></p>}
        {course.total_reviews > 0 && (
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <Stars rating={rating} />
            <span className="text-xs font-bold" style={{ color: '#002050' }}>{rating.toFixed(1)}</span>
            <span className="text-xs" style={{ color: '#6B7280' }}>({course.total_reviews} avis)</span>
          </div>
        )}
        {(course.cpd_hours ?? 0) > 0 && <p className="text-xs" style={{ color: '#6B7280' }}>Crédits reconnus · {course.cpd_hours} h</p>}
        {isExternal && <p className="mt-1 inline-flex items-center gap-1 text-xs font-semibold" style={{ color: course.access_mode === 'premium' || course.access_mode === 'paid' ? '#8A5F09' : '#6B7280' }}>{course.access_mode === 'premium' || course.access_mode === 'paid' ? <LockKeyhole size={12} /> : course.access_mode === 'registered' ? <LogIn size={12} /> : <ExternalLink size={12} />}{accessLabel}{course.access_mode !== 'paid' && course.is_free ? ' · Gratuit chez le fournisseur' : ''}{course.certificate_available ? ' · Certificat disponible' : ''}</p>}
      </div>

      <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F0F0F0' }}>
        <span className="font-bold" style={{ color: isExternal ? '#002050' : course.is_free ? '#1E7A52' : '#002050', fontSize: '15px' }}>
          {isExternal ? externalPriceLabel : course.is_free ? 'Gratuit' : `${course.price_xof.toLocaleString('fr-FR')} XOF`}
        </span>
        {isExternal && (course.external_click_count ?? 0) > 0 ? (
          <span className="text-xs" style={{ color: '#6B7280' }}>{course.external_click_count?.toLocaleString('fr-FR')} visites</span>
        ) : (course.total_students ?? 0) > 0 ? (
          <span className="text-xs" style={{ color: '#6B7280' }}>{course.total_students?.toLocaleString('fr-FR')} apprenants</span>
        ) : null}
      </div>
    </Link>
  );
}
