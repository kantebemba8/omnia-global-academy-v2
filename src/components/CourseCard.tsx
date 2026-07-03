import { useNavigate } from 'react-router-dom';
import { BookOpen } from 'lucide-react';

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
}

const LEVEL_COLORS: Record<string, string> = {
  'Débutant':      '#1E7A52',
  'Intermédiaire': '#F59E0B',
  'Avancé':        '#DC2626',
  'Expert':        '#7C3AED',
};

function Stars({ rating }: { rating: number }) {
  const n = Math.round(rating);
  return (
    <span style={{ color: '#BF8813', fontSize: '13px', letterSpacing: '1px' }}>
      {'★'.repeat(n)}{'☆'.repeat(5 - n)}
    </span>
  );
}

interface CourseCardProps {
  course: CourseCardData;
  variant?: 'grid' | 'list';
}

export function CourseCard({ course, variant = 'grid' }: CourseCardProps) {
  const navigate = useNavigate();
  const levelColor = LEVEL_COLORS[course.level] ?? '#6B7280';

  if (variant === 'list') {
    return (
      <div
        className="flex gap-4 rounded-xl overflow-hidden cursor-pointer transition-shadow hover:shadow-md"
        style={{ border: '1px solid #E4E7EC', backgroundColor: '#FFFFFF' }}
        onClick={() => navigate(`/cours/${course.id}`)}
      >
        <div className="flex-shrink-0 w-40 relative" style={{ backgroundColor: '#F8F9FA' }}>
          {course.cover_image_url
            ? <img src={course.cover_image_url} alt={course.title} className="w-full h-full object-cover" style={{ minHeight: '90px' }} />
            : <div className="w-full h-full flex items-center justify-center" style={{ minHeight: '90px' }}><BookOpen size={24} style={{ color: '#BF8813' }} /></div>
          }
        </div>
        <div className="flex-1 py-3 pr-4">
          <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#6B7280' }}>{course.category}</p>
          <p className="text-sm font-semibold mb-1 line-clamp-1" style={{ color: '#002050' }}>{course.title}</p>
          {course.creator_name && <p className="text-xs mb-1" style={{ color: '#6B7280' }}>Par {course.creator_name}</p>}
          <div className="flex items-center gap-1.5">
            <Stars rating={course.average_rating} />
            <span className="text-xs font-bold" style={{ color: '#002050' }}>{course.average_rating.toFixed(1)}</span>
            <span className="text-xs" style={{ color: '#6B7280' }}>({course.total_reviews})</span>
          </div>
        </div>
        <div className="flex-shrink-0 flex flex-col justify-center pr-4 text-right">
          <span className="font-bold" style={{ color: course.is_free ? '#1E7A52' : '#002050', fontSize: '15px' }}>
            {course.is_free ? 'Gratuit' : `${course.price_xof.toLocaleString()} XOF`}
          </span>
          {(course.total_students ?? 0) > 0 && (
            <span className="text-xs" style={{ color: '#6B7280' }}>{course.total_students?.toLocaleString()} élèves</span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl overflow-hidden cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 flex flex-col"
      style={{ border: '1px solid #E4E7EC', backgroundColor: '#FFFFFF' }}
      onClick={() => navigate(`/cours/${course.id}`)}
    >
      {/* Cover */}
      <div className="relative flex-shrink-0" style={{ aspectRatio: '16/9', overflow: 'hidden', backgroundColor: '#F8F9FA' }}>
        {course.cover_image_url
          ? <img src={course.cover_image_url} alt={course.title} className="w-full h-full object-cover" />
          : <div className="w-full h-full flex items-center justify-center"><BookOpen size={32} style={{ color: '#BF8813' }} /></div>
        }
        {/* Badges */}
        <span
          className="absolute top-2 right-2 text-white text-xs font-semibold px-2 py-0.5 rounded-full"
          style={{ backgroundColor: levelColor }}
        >
          {course.level}
        </span>
        {course.cpd_accredited && (
          <span className="absolute top-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#BF8813', color: '#FFF' }}>
            CPD ✓
          </span>
        )}
        {course.is_free && (
          <span className="absolute bottom-2 left-2 text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#1E7A52', color: '#FFF' }}>
            GRATUIT
          </span>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 flex flex-col p-4">
        <p className="text-xs uppercase tracking-wide mb-1" style={{ color: '#6B7280' }}>{course.category ?? ''}</p>
        <p className="text-sm font-semibold mb-1 line-clamp-2 leading-snug flex-1" style={{ color: '#002050' }}>{course.title}</p>
        {course.creator_name && (
          <p className="text-xs mb-2" style={{ color: '#6B7280' }}>Par {course.creator_name}</p>
        )}
        <div className="flex items-center gap-1.5 mb-1">
          <Stars rating={course.average_rating} />
          <span className="text-xs font-bold" style={{ color: '#002050' }}>{course.average_rating.toFixed(1)}</span>
          <span className="text-xs" style={{ color: '#6B7280' }}>({course.total_reviews} avis)</span>
        </div>
        {(course.cpd_hours ?? 0) > 0 && (
          <p className="text-xs" style={{ color: '#6B7280' }}>⏱ {course.cpd_hours}h CPD</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: '1px solid #F0F0F0' }}>
        <span className="font-bold" style={{ color: course.is_free ? '#1E7A52' : '#002050', fontSize: '15px' }}>
          {course.is_free ? 'Gratuit' : `${course.price_xof.toLocaleString()} XOF`}
        </span>
        {(course.total_students ?? 0) > 0 && (
          <span className="text-xs" style={{ color: '#6B7280' }}>{course.total_students?.toLocaleString()} élèves</span>
        )}
      </div>
    </div>
  );
}
