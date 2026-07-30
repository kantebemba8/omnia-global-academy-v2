import { useEffect, useState } from 'react';
import { Award, Eye, Download, CheckCircle, XCircle } from 'lucide-react';
import { DashboardLayout } from '../../components/DashboardLayout';
import { edgeAuthHeaders } from '../../lib/edgeAuth';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';

type Certificate = {
  id: string;
  omnia_certificate_id: string;
  student_full_name: string;
  course_title: string;
  issued_at: string | null;
  cpd_accredited: boolean;
  status: string;
  pdf_url?: string | null;
};

function isRevoked(status: string) {
  return ['revoked', 'revoque', 'révoqué'].includes(String(status || '').toLowerCase());
}

export default function ProfesseurCertificats() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, cpd: 0, revoked: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { void loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/dashboard-professeur`, { headers: edgeAuthHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Impossible de charger les certificats.');
      const certs = Array.isArray(data.certificates) ? data.certificates as Certificate[] : [];
      setCertificates(certs);
      setStats({
        total: certs.length,
        active: certs.filter((certificate) => !isRevoked(certificate.status)).length,
        cpd: certs.filter((certificate) => certificate.cpd_accredited).length,
        revoked: certs.filter((certificate) => isRevoked(certificate.status)).length,
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Impossible de charger les certificats.');
    } finally {
      setLoading(false);
    }
  }

  const exportCSV = () => {
    const escape = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
    const csv = [
      ['ID', 'Étudiant', 'Formation', 'Date', 'CPD', 'Statut'],
      ...certificates.map((certificate) => [
        certificate.omnia_certificate_id,
        certificate.student_full_name,
        certificate.course_title,
        certificate.issued_at ? new Date(certificate.issued_at).toLocaleDateString('fr-FR') : '',
        certificate.cpd_accredited ? 'Oui' : 'Non',
        isRevoked(certificate.status) ? 'Révoqué' : 'Actif',
      ]),
    ].map((row) => row.map(escape).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'certificats.csv';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout role="professeur">
      <div className="mx-auto max-w-6xl space-y-6 p-6 lg:p-8">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Certificats de mes formations</h1>
          <p className="mt-1 text-sm" style={{ color: '#6B7280' }}>Consultez les certificats réellement délivrés aux apprenants de vos formations.</p>
        </div>

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[
            { label: 'Total délivrés', value: stats.total, icon: Award, color: '#002050' },
            { label: 'Actifs', value: stats.active, icon: CheckCircle, color: '#1E7A52' },
            { label: 'CPD certifiés', value: stats.cpd, icon: Award, color: '#BF8813' },
            { label: 'Révoqués', value: stats.revoked, icon: XCircle, color: '#DC2626' },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border bg-white p-4" style={{ borderColor: '#E4E7EC' }}>
              <stat.icon size={20} style={{ color: stat.color }} className="mb-2" />
              <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
              <div className="mt-1 text-xs" style={{ color: '#6B7280' }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <p>{error}</p>
            <button type="button" onClick={() => void loadData()} className="mt-2 font-semibold underline">Réessayer</button>
          </div>
        )}

        <div className="overflow-hidden rounded-xl border bg-white" style={{ borderColor: '#E4E7EC' }}>
          <div className="flex items-center justify-between border-b px-4 py-4 sm:px-6" style={{ borderColor: '#E4E7EC' }}>
            <h2 className="font-semibold" style={{ color: '#002050' }}>Certificats délivrés</h2>
            <button type="button" onClick={exportCSV} disabled={!certificates.length}
              className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-40"
              style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
              <Download size={14} /> Exporter CSV
            </button>
          </div>

          {loading ? (
            <div className="flex h-32 items-center justify-center"><div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: '#002050', borderTopColor: 'transparent' }} /></div>
          ) : certificates.length === 0 ? (
            <div className="py-12 text-center"><Award size={32} style={{ color: '#E4E7EC' }} className="mx-auto mb-3" /><p style={{ color: '#6B7280' }}>Aucun certificat délivré pour vos formations</p></div>
          ) : (
            <div className="oga-table-scroll">
              <table className="w-full min-w-[900px]">
                <thead><tr style={{ borderBottom: '1px solid #E4E7EC', backgroundColor: '#F8F9FA' }}>
                  {['ID', 'Étudiant', 'Formation', 'Date', 'CPD', 'Statut', ''].map((heading) => <th key={heading} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: '#6B7280' }}>{heading}</th>)}
                </tr></thead>
                <tbody>
                  {certificates.map((certificate, index) => (
                    <tr key={certificate.id} style={{ borderBottom: index < certificates.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                      <td className="px-4 py-3"><span className="font-mono text-xs" style={{ color: '#002050' }}>{certificate.omnia_certificate_id}</span></td>
                      <td className="px-4 py-3 text-sm text-gray-700">{certificate.student_full_name}</td>
                      <td className="px-4 py-3 text-sm text-gray-700">{certificate.course_title}</td>
                      <td className="px-4 py-3 text-xs text-gray-500">{certificate.issued_at ? new Date(certificate.issued_at).toLocaleDateString('fr-FR') : '—'}</td>
                      <td className="px-4 py-3">{certificate.cpd_accredited ? <span className="text-xs font-semibold" style={{ color: '#BF8813' }}>✓ CPD</span> : <span className="text-xs text-gray-400">—</span>}</td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isRevoked(certificate.status) ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>{isRevoked(certificate.status) ? 'Révoqué' : 'Actif'}</span></td>
                      <td className="px-4 py-3"><div className="flex gap-2">
                        <a href={`/verify/${certificate.omnia_certificate_id}`} target="_blank" rel="noopener noreferrer" className="rounded p-1.5 hover:bg-gray-100" aria-label="Vérifier le certificat"><Eye size={14} className="text-gray-500" /></a>
                        {certificate.pdf_url && <a href={certificate.pdf_url} target="_blank" rel="noopener noreferrer" className="rounded p-1.5 hover:bg-gray-100" aria-label="Télécharger le certificat"><Download size={14} className="text-gray-500" /></a>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
