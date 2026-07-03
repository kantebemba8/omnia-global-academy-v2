import { Settings } from 'lucide-react';

interface MaintenancePageProps {
  maintenanceMessage?: string;
  maintenanceEndTime?: string;
}

export function MaintenancePage({
  maintenanceMessage = '',
  maintenanceEndTime,
}: MaintenancePageProps) {
  const formattedEndTime = maintenanceEndTime
    ? new Date(maintenanceEndTime).toLocaleString('fr-FR', {
        weekday: 'long',
        day: '2-digit',
        month: 'long',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ backgroundColor: '#002050' }}
    >
      <div className="flex flex-col items-center text-center max-w-md px-6">
        <img
          src="/IMG_0349.png"
          className="h-16 object-contain mb-8"
          alt="Omnia Logo"
        />

        <div className="mb-8">
          <Settings
            size={64}
            color="#BF8813"
            className="animate-spin mx-auto"
            style={{ animationDuration: '3s' }}
          />
        </div>

        <h1 className="text-white font-bold text-3xl mb-4">Maintenance en cours</h1>

        {maintenanceMessage && (
          <p className="text-white text-opacity-70 text-sm mb-4">
            {maintenanceMessage}
          </p>
        )}

        {formattedEndTime && (
          <p className="text-white text-opacity-70 text-sm mb-6">
            Retour prévu : {formattedEndTime}
          </p>
        )}

        <p className="text-white text-opacity-70 text-sm">
          Pour toute question :{' '}
          <a
            href="mailto:contact@omniaglobalacademy.com"
            className="font-semibold"
            style={{ color: '#BF8813' }}
          >
            contact@omniaglobalacademy.com
          </a>
        </p>
      </div>
    </div>
  );
}
