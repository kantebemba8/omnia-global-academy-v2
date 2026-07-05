import { useState, useEffect } from 'react';
import { Award, Eye, Download, CheckCircle, XCircle } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function ProfesseurCertificats() {
  const [certificates, setCertificates] = useState<any[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, cpd: 0, revoked: 0 });
  const [loading, setLoading] = useState(true);
  const [professionalName, setProfessionalName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameSuccess, setNameSuccess] = useState(false);
  const [allowSignature, setAllowSignature] = useState(false);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const token = localStorage.getItem('omnia_session_token');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/dashboard-professeur`,
        { headers: { 'Authorization': `Bearer ${token}` } });
      const data = await res.json();
      const certs = data.certificates || [];
      setCertificates(certs);
      setStats({
        total: certs.length,
        active: certs.filter((c: any) => c.status === 'active').length,
        cpd: certs.filter((c: any) => c.cpd_accredited).length,
        revoked: certs.filter((c: any) => c.status === 'revoked').length,
      });
      setProfessionalName(data.professeur?.professional_name || '');
      const settingsRes = await fetch(`${SUPABASE_URL}/functions/v1/site-settings-public`);
      const settings = await settingsRes.json();
      setAllowSignature(settings.allow_professor_signature === 'true');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveProfessionalName() {
    setSavingName(true);
    try {
      const token = localStorage.getItem('omnia_session_token');
      await fetch(`${SUPABASE_URL}/functions/v1/auth-update-profile`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ professional_name: professionalName }),
      });
      setNameSuccess(true);
      setTimeout(() => setNameSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSavingName(false);
    }
  }

  const exportCSV = () => {
    const csv = [
      ['ID', 'Étudiant', 'Formation', 'Date', 'CPD', 'Statut'],
      ...certificates.map(c => [
        c.omnia_certificate_id, c.student_full_name, c.course_title,
        c.issued_at ? new Date(c.issued_at).toLocaleDateString('fr-FR') : '',
        c.cpd_accredited ? 'Oui' : 'Non',
        c.status === 'revoked' ? 'Révoqué' : 'Actif',
      ])
    ].map(r => r.join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'certificats.csv';
    a.click();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>
          Certificats de mes formations
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
          Gérez les certificats délivrés aux apprenants de vos formations
        </p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total délivrés', value: stats.total, icon: Award, color: '#002050' },
          { label: 'Actifs', value: stats.active, icon: CheckCircle, color: '#1E7A52' },
          { label: 'CPD certifiés', value: stats.cpd, icon: Award, color: '#BF8813' },
          { label: 'Révoqués', value: stats.revoked, icon: XCircle, color: '#DC2626' },
        ].map((stat, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border" style={{ borderColor: '#E4E7EC' }}>
            <stat.icon size={20} style={{ color: stat.color }} className="mb-2" />
            <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
            <div className="text-xs mt-1" style={{ color: '#6B7280' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-xl border p-6 space-y-4" style={{ borderColor: '#E4E7EC' }}>
        <h2 className="font-semibold" style={{ color: '#002050' }}>Mes paramètres de certificat</h2>
        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: '#002050' }}>
            Nom professionnel affiché sur les certificats
          </label>
          <div className="flex gap-3">
            <input type="text" value={professionalName}
              onChange={e => setProfessionalName(e.target.value)}
              placeholder="Ex: Dr. Oumar Traoré"
              className="flex-1 px-3 py-2.5 border rounded-lg text-sm"
              style={{ borderColor: '#E4E7EC' }} />
            <button onClick={saveProfessionalName} disabled={savingName}
              className="px-4 py-2.5 rounded-lg font-semibold text-white text-sm disabled:opacity-50"
              style={{ backgroundColor: '#002050' }}>
              {savingName ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
          {nameSuccess && (
            <p className="text-xs mt-1 font-medium" style={{ color: '#1E7A52' }}>
              ✓ Nom professionnel mis à jour
            </p>
          )}
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            Ce nom apparaîtra sur tous vos certificats Template A
          </p>
        </div>
        {allowSignature && (
          <div className="p-4 rounded-lg border"
            style={{ borderColor: '#BF8813', backgroundColor: 'rgba(191,136,19,0.03)' }}>
            <p className="text-sm font-semibold" style={{ color: '#002050' }}>
              🖊️ Signature autorisée par le Super-admin
            </p>
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
              Uploadez votre signature depuis votre profil. Elle apparaîtra sur vos certificats.
            </p>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden" style={{ borderColor: '#E4E7EC' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: '#E4E7EC' }}>
          <h2 className="font-semibold" style={{ color: '#002050' }}>Certificats délivrés</h2>
          <button onClick={exportCSV}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border"
            style={{ borderColor: '#E4E7EC', color: '#6B7280' }}>
            <Download size={14} />
            Exporter CSV
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-6 h-6 border-2 rounded-full animate-spin"
              style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
          </div>
        ) : certificates.length === 0 ? (
          <div className="text-center py-12">
            <Award size={32} style={{ color: '#E4E7EC' }} className="mx-auto mb-3" />
            <p style={{ color: '#6B7280' }}>Aucun certificat délivré pour vos formations</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr style={{ borderBottom: '1px solid #E4E7EC', backgroundColor: '#F8F9FA' }}>
                {['ID', 'Étudiant', 'Formation', 'Date', 'CPD', 'Statut', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold"
                    style={{ color: '#6B7280' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {certificates.map((cert, i) => (
                <tr key={cert.id || i}
                  style={{ borderBottom: i < certificates.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs" style={{ color: '#002050' }}>
                      {cert.omnia_certificate_id}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#374151' }}>
                    {cert.student_full_name}
                  </td>
                  <td className="px-4 py-3 text-sm" style={{ color: '#374151' }}>
                    {cert.course_title}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: '#6B7280' }}>
                    {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString('fr-FR') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {cert.cpd_accredited
                      ? <span className="text-xs font-semibold" style={{ color: '#BF8813' }}>✓ CPD</span>
                      : <span className="text-xs" style={{ color: '#9CA3AF' }}>—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      cert.status === 'revoked' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
                    }`}>
                      {cert.status === 'revoked' ? 'Révoqué' : 'Actif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <a href={`/verify/${cert.omnia_certificate_id}`}
                        target="_blank" rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-gray-100">
                        <Eye size={14} style={{ color: '#6B7280' }} />
                      </a>
                      {cert.pdf_url ? (
                        <a href={cert.pdf_url}
                          target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-gray-100">
                          <Download size={14} style={{ color: '#6B7280' }} />
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
