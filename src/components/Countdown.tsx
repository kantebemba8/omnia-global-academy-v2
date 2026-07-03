import { useState, useEffect } from 'react';

interface CountdownProps {
  targetDate: string;
  variant?: 'dark' | 'light';
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function Countdown({ targetDate, variant = 'dark' }: CountdownProps) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(targetDate).getTime() - new Date().getTime();
      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [targetDate]);

  const isLight = variant === 'light';

  const timeUnits = [
    { value: timeLeft.days,    label: 'JOURS' },
    { value: timeLeft.hours,   label: 'HEURES' },
    { value: timeLeft.minutes, label: 'MINUTES' },
    { value: timeLeft.seconds, label: 'SECONDES' },
  ];

  return (
    <div className="flex flex-wrap justify-start gap-3 md:gap-4">
      {timeUnits.map((unit, index) => (
        <div key={unit.label} className="flex items-center gap-1">
          <div
            className="rounded-xl px-4 py-3 md:px-6 md:py-4 min-w-[70px] md:min-w-[90px]"
            style={{
              backgroundColor: isLight ? 'rgba(0,32,80,0.07)' : 'rgba(255,255,255,0.10)',
              border: isLight ? '1px solid rgba(0,32,80,0.12)' : 'none',
            }}
          >
            <span
              className="block text-2xl md:text-4xl font-bold text-center font-mono"
              style={{ color: isLight ? '#002050' : '#FFFFFF' }}
            >
              {String(unit.value).padStart(2, '0')}
            </span>
            <span
              className="block text-xs md:text-sm text-center mt-1 font-medium"
              style={{ color: '#BF8813' }}
            >
              {unit.label}
            </span>
          </div>
          {index < timeUnits.length - 1 && (
            <span
              className="text-2xl md:text-4xl font-bold hidden md:block"
              style={{ color: '#BF8813' }}
            >
              .
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
