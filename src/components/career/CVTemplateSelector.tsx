const TEMPLATES = [
  { key: 'classic_pro',   label: 'Classic Pro',   free: true },
  { key: 'modern_student',label: 'Modern Student', free: true },
  { key: 'corporate_blue',label: 'Corporate Blue', free: true },
  { key: 'minimal_luxe',  label: 'Minimal Luxe',  free: true },
  { key: 'africa_gold',   label: 'Africa Gold',   free: true },
  { key: 'tech_future',   label: 'Tech Future',   free: false },
  { key: 'creative_digital','label':'Creative Digital', free: false },
  { key: 'executive_one_page','label':'Executive One Page', free: false },
];

export function CVTemplateSelector({
  value,
  themeColor,
  onChange,
}: {
  value: string;
  themeColor: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {TEMPLATES.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className="flex flex-col items-center gap-1 rounded-xl border-2 p-2 text-center transition-all hover:shadow-md"
          style={{
            borderColor: value === t.key ? '#002050' : '#E5E7EB',
            background: value === t.key ? 'rgba(0,32,80,0.04)' : 'white',
          }}
        >
          {/* Mini aperçu */}
          <div className="h-14 w-full overflow-hidden rounded-lg" style={{ background: '#F8FAFC' }}>
            <div className="flex h-full" style={{ fontSize: '3px' }}>
              <div className="h-full w-1/3" style={{ background: themeColor, opacity: 0.8 }} />
              <div className="flex-1 p-1">
                <div className="mb-0.5 h-0.5 rounded" style={{ background: themeColor, width: '70%' }} />
                <div className="h-0.5 rounded" style={{ background: '#bf8813', width: '45%' }} />
              </div>
            </div>
          </div>
          <span className="text-xs font-medium leading-tight" style={{ color: '#002050' }}>{t.label}</span>
          {!t.free && (
            <span className="rounded px-1 text-[10px] font-semibold" style={{ background: '#FEF3C7', color: '#bf8813' }}>
              Premium
            </span>
          )}
          {t.free && (
            <span className="rounded px-1 text-[10px] font-semibold" style={{ background: '#D1FAE5', color: '#065F46' }}>
              Gratuit
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
