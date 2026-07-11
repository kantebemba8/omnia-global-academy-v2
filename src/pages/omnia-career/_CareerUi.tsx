import { ReactNode } from 'react';

export const OMNIA_BLUE = '#002050';
export const OMNIA_GOLD = '#bf8813';
export const OMNIA_BG = '#F8F9FA';
export const OMNIA_BORDER = '#E5E7EB';
export const OMNIA_MUTED = '#6B7280';

export function CareerCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function PageHeading({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-[#002050]">{title}</h1>
        <p className="mt-1 text-sm leading-6 text-slate-500">{subtitle}</p>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function ButtonPrimary({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <button onClick={onClick} className={`rounded-lg bg-[#002050] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${className}`}>{children}</button>;
}

export function ButtonGold({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <button onClick={onClick} className={`rounded-lg bg-[#bf8813] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 ${className}`}>{children}</button>;
}

export function ButtonSoft({ children, className = '', onClick }: { children: ReactNode; className?: string; onClick?: () => void }) {
  return <button onClick={onClick} className={`rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 ${className}`}>{children}</button>;
}
