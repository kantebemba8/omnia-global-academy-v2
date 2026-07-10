import { ReactNode } from 'react';

export function CareerCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

export function PageHeading({ title, subtitle, actions }: { title: string; subtitle: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex items-start justify-between gap-6">
      <div>
        <h1 className="text-[32px] font-black tracking-tight text-[#061B3A]">{title}</h1>
        <p className="mt-1 text-[15px] text-slate-500">{subtitle}</p>
      </div>
      {actions && <div className="flex items-center gap-3">{actions}</div>}
    </div>
  );
}

export function ButtonPrimary({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <button className={`rounded-xl bg-[#061B3A] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#0B2A5B] ${className}`}>{children}</button>;
}

export function ButtonGold({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <button className={`rounded-xl bg-[#F6C64A] px-5 py-3 text-sm font-black text-[#061B3A] shadow-sm transition hover:bg-[#D6A11E] ${className}`}>{children}</button>;
}

export function ButtonSoft({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <button className={`rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-black text-slate-700 shadow-sm transition hover:bg-slate-50 ${className}`}>{children}</button>;
}
