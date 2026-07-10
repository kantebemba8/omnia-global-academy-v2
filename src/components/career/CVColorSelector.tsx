const COLORS = [
  { value: '#002050', label: 'Bleu OGA' },
  { value: '#1E3A5F', label: 'Bleu marine' },
  { value: '#1B4332', label: 'Vert forêt' },
  { value: '#0D1117', label: 'Noir tech' },
  { value: '#7C3AED', label: 'Violet' },
  { value: '#DC2626', label: 'Rouge' },
  { value: '#78350F', label: 'Brun' },
  { value: '#374151', label: 'Gris' },
  { value: '#bf8813', label: 'Or' },
  { value: '#0369A1', label: 'Bleu ciel' },
];

export function CVColorSelector({
  value,
  onChange,
}: {
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLORS.map((c) => (
        <button
          key={c.value}
          type="button"
          title={c.label}
          onClick={() => onChange(c.value)}
          className="h-7 w-7 rounded-full border-2 transition-transform hover:scale-110"
          style={{
            backgroundColor: c.value,
            borderColor: value === c.value ? '#002050' : 'transparent',
            outline: value === c.value ? '2px solid #bf8813' : 'none',
            outlineOffset: '2px',
          }}
        />
      ))}
    </div>
  );
}
