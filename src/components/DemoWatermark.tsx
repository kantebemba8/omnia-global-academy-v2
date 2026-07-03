export default function DemoWatermark() {
  return (
    <div
      className="fixed inset-0 pointer-events-none select-none overflow-hidden"
      style={{ zIndex: 1 }}
      aria-hidden="true"
    >
      {/* Repeating diagonal DÉMO pattern */}
      {Array.from({ length: 6 }).map((_, row) =>
        Array.from({ length: 4 }).map((_, col) => (
          <span
            key={`${row}-${col}`}
            className="absolute font-black uppercase tracking-widest"
            style={{
              color: 'rgba(245,158,11,0.06)',
              fontSize: '120px',
              transform: 'rotate(-35deg)',
              top: `${row * 280 - 80}px`,
              left: `${col * 420 - 100}px`,
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          >
            DÉMO
          </span>
        ))
      )}
    </div>
  );
}
