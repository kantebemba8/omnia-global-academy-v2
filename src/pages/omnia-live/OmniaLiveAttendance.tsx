import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import OmniaLiveLayout from '../../components/omnia-live/OmniaLiveLayout';
import { liveApi } from './liveApi';

interface AttendanceRow {
  user_id: string;
  duration_seconds?: number;
  segments?: number;
  user?: { full_name?: string | null } | null;
}

export default function OmniaLiveAttendance() {
  const { liveId } = useParams();
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    if (!liveId) {
      setLoading(false);
      setError('Événement introuvable.');
      return () => { active = false; };
    }

    setLoading(true);
    setError('');
    liveApi('attendance_summary', {}, { event_id: liveId })
      .then((data) => {
        if (active) setRows(data.participants || []);
      })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Les données de présence sont indisponibles.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [liveId]);

  return (
    <OmniaLiveLayout>
      <section className="mx-auto max-w-5xl px-4 py-10 md:px-8">
        <h1 className="text-3xl font-black" style={{ color: '#002050' }}>Présence</h1>
        <p className="mt-2 text-sm text-slate-500">Durée cumulée et reconnexions des participants à cet événement.</p>

        {error && <div role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-red-700">{error}</div>}

        {loading ? (
          <div role="status" aria-live="polite" className="mt-6 flex min-h-48 items-center justify-center rounded-2xl border bg-white">
            <div className="text-center">
              <div aria-hidden="true" className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-t-transparent" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
              <p className="mt-3 text-sm text-slate-500">Chargement des présences…</p>
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="mt-6 rounded-2xl border bg-white p-10 text-center text-sm text-slate-500">Aucune donnée de présence.</div>
        ) : (
          <div className="oga-table-scroll mt-6 rounded-2xl border bg-white">
            <table className="w-full min-w-[620px] text-left text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th scope="col" className="p-4">Participant</th>
                  <th scope="col" className="p-4">Durée cumulée</th>
                  <th scope="col" className="p-4">Reconnexions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const duration = Math.max(0, row.duration_seconds || 0);
                  return (
                    <tr key={row.user_id} className="border-t">
                      <td className="p-4 font-semibold">{row.user?.full_name || row.user_id}</td>
                      <td className="p-4">{Math.floor(duration / 3600)} h {Math.floor((duration % 3600) / 60)} min</td>
                      <td className="p-4">{row.segments || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </OmniaLiveLayout>
  );
}
