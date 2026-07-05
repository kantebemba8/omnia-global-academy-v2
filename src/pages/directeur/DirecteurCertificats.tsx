import { useState, useEffect, useRef } from 'react';
import { Award, Upload, Eye, Download, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function DirecteurCertificats() {
  const [certificates, setCertificates] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [sigPreview, setSigPreview] = useState<string | null>(null);
  const logoRef = useRef<HTMLInputElement>(null);
  const sigRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    try {
      const token = localStorage.getItem('omnia_session_token');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/dashboard-directeur`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setCertificates(data.certificates || []);
      setProfile(data.etablissement || null);
      setLogoPreview(data.etablissement?.logo_url || null);
      setSigPreview(data.etablissement?.signature_url || null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function toBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function uploadAsset(file: File, type: 'logo' | 'signature') {
    setSaving(true);
    setSuccess('');
    try {
      const token = localStorage.getItem('omnia_session_token');
      const base64 = await toBase64(file);
      const preview = URL.createObjectURL(file);

      if (type === 'logo') setLogoPreview(preview);
      else setSigPreview(preview);

      await fetch(`${SUPABASE_URL}/functions/v1/auth-update-profile`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          [`${type}_base64`]: base64,
          [`${type}_mime`]: file.type,
        }),
      });

      setSuccess(type === 'logo'
        ? '✓ Logo mis à jour avec succès'
        : '✓ Signature mise à jour avec succès');
      setTimeout(() => setSuccess(''), 3000);
      loadData();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  const hasLogo = !!profile?.logo_url;
  const hasSig = !!profile?.signature_url;
  const isReady = hasLogo && hasSig;

  const stats = {
    total: certificates.length,
    active: certificates.filter(c => c.status === 'active').length,
    cpd: certificates.filter(c => c.cpd_accredited).length,
    revoked: certificates.filter(c => c.status === 'revoked').length,
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>
          Certificats de l'établissement
        </h1>
        <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
          Gérez les certificats délivrés aux apprenants de votre établissement
        </p>
      </div>

      {/* Alerte si pas prêt */}
      {!isReady && (
        <div className="p-4 rounded-xl border flex items-start gap-3"
          style={{ borderColor: '#F97316', backgroundColor: '#FFF7ED' }}>
          <AlertTriangle size={20} style={{ color: '#F97316', flexShrink: 0 }} />
          <div>
            <p className="font-semibold text-sm" style={{ color: '#7C3A00' }}>
              Configuration requise avant génération de certificats
            </p>
            <p className="text-sm mt-1" style={{ color: '#7C3A00' }}>
              Vous devez uploader votre logo{!hasLogo ? ' ❌' : ' ✓'}
              {' '}et la signature du directeur{!hasSig ? ' ❌' : ' ✓'}
              {' '}pour que les certificats puissent être générés.
            </p>
          </div>
        </div>
      )}

      {isReady && (
        <div className="p-4 rounded-xl border flex items-center gap-3"
          style={{ borderColor: '#1E7A52', backgroundColor: '#E4F1EA' }}>
          <CheckCircle size={20} style={{ color: '#1E7A52' }} />
          <p className="text-sm font-semibold" style={{ color: '#1E7A52' }}>
            ✓ Votre établissement est prêt à délivrer des certificats
          </p>
        </div>
      )}

      {/* Upload logo et signature */}
      <div className="grid grid-cols-2 gap-6">

        {/* Logo */}
        <div className="bg-white rounded-xl border p-6 space-y-4"
          style={{ borderColor: '#E4E7EC' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: '#002050' }}>
              Logo de l'établissement
            </h2>
            {hasLogo
              ? <span className="text-xs font-medium px-2 py-1 rounded-full"
                  style={{ backgroundColor: '#E4F1EA', color: '#1E7A52' }}>✓ Configuré</span>
              : <span className="text-xs font-medium px-2 py-1 rounded-full"
                  style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>⚠ Requis</span>
            }
          </div>

          {logoPreview ? (
            <div className="h-24 rounded-lg border flex items-center justify-center"
              style={{ borderColor: '#E4E7EC', backgroundColor: '#F8F9FA' }}>
              <img src={logoPreview} alt="Logo" className="h-16 object-contain" />
            </div>
          ) : (
            <div className="h-24 rounded-lg border-2 border-dashed flex items-center justify-center"
              style={{ borderColor: '#E4E7EC' }}>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>Aucun logo</p>
            </div>
          )}

          <input ref={logoRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && uploadAsset(e.target.files[0], 'logo')} />
          <button onClick={() => logoRef.current?.click()} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium text-sm disabled:opacity-50"
            style={{ borderColor: '#002050', color: '#002050' }}>
            <Upload size={16} />
            {logoPreview ? 'Changer le logo' : 'Uploader le logo'}
          </button>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            PNG ou JPG recommandé — fond transparent de préférence
          </p>
        </div>

        {/* Signature */}
        <div className="bg-white rounded-xl border p-6 space-y-4"
          style={{ borderColor: '#E4E7EC' }}>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold" style={{ color: '#002050' }}>
              Signature du directeur
            </h2>
            {hasSig
              ? <span className="text-xs font-medium px-2 py-1 rounded-full"
                  style={{ backgroundColor: '#E4F1EA', color: '#1E7A52' }}>✓ Configurée</span>
              : <span className="text-xs font-medium px-2 py-1 rounded-full"
                  style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>⚠ Requise</span>
            }
          </div>

          {sigPreview ? (
            <div className="h-24 rounded-lg border flex items-center justify-center"
              style={{ borderColor: '#E4E7EC', backgroundColor: '#F8F9FA' }}>
              <img src={sigPreview} alt="Signature" className="h-16 object-contain" />
            </div>
          ) : (
            <div className="h-24 rounded-lg border-2 border-dashed flex items-center justify-center"
              style={{ borderColor: '#E4E7EC' }}>
              <p className="text-sm" style={{ color: '#9CA3AF' }}>Aucune signature</p>
            </div>
          )}

          <input ref={sigRef} type="file" accept="image/*" className="hidden"
            onChange={e => e.target.files?.[0] && uploadAsset(e.target.files[0], 'signature')} />
          <button onClick={() => sigRef.current?.click()} disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium text-sm disabled:opacity-50"
            style={{ borderColor: '#002050', color: '#002050' }}>
            <Upload size={16} />
            {sigPreview ? 'Changer la signature' : 'Uploader la signature'}
          </button>
          <p className="text-xs" style={{ color: '#6B7280' }}>
            PNG avec fond transparent — signature manuscrite numérisée
          </p>
        </div>
      </div>

      {success && (
        <div className="p-3 rounded-lg text-sm font-medium"
          style={{ backgroundColor: '#E4F1EA', color: '#1E7A52' }}>
          {success}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Total délivrés', value: stats.total, color: '#002050' },
          { label: 'Actifs', value: stats.active, color: '#1E7A52' },
          { label: 'CPD certifiés', value: stats.cpd, color: '#BF8813' },
          { label: 'Révoqués', value: stats.revoked, color: '#DC2626' },
        ].map((s, i) => (
          <div key={i} className="bg-white rounded-xl p-4 border"
            style={{ borderColor: '#E4E7EC' }}>
            <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
            <div className="text-xs mt-1" style={{ color: '#6B7280' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Liste certificats */}
      <div className="bg-white rounded-xl border overflow-hidden"
        style={{ borderColor: '#E4E7EC' }}>
        <div className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: '#E4E7EC' }}>
          <h2 className="font-semibold" style={{ color: '#002050' }}>
            Certificats délivrés
          </h2>
          <button
            onClick={() => {
              const csv = [
                ['ID', 'Étudiant', 'Formation', 'Date', 'CPD', 'Statut'],
                ...certificates.map(c => [
                  c.omnia_certificate_id,
                  c.student_full_name,
                  c.course_title,
                  c.issued_at ? new Date(c.issued_at).toLocaleDateString('fr-FR') : '',
                  c.cpd_accredited ? 'Oui' : 'Non',
                  c.status === 'revoked' ? 'Révoqué' : 'Actif',
                ])
              ].map(r => r.join(',')).join('\n');
              const blob = new Blob([csv], { type: 'text/csv' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = 'certificats-etablissement.csv';
              a.click();
            }}
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
            <p style={{ color: '#6B7280' }}>Aucun certificat délivré</p>
            {!isReady && (
              <p className="text-sm mt-2" style={{ color: '#F97316' }}>
                Configurez d'abord votre logo et signature
              </p>
            )}
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
                <tr key={cert.id}
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
                    {cert.issued_at
                      ? new Date(cert.issued_at).toLocaleDateString('fr-FR')
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {cert.cpd_accredited
                      ? <span className="text-xs font-semibold" style={{ color: '#BF8813' }}>✓ CPD</span>
                      : <span className="text-xs" style={{ color: '#9CA3AF' }}>—</span>
                    }
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
                      {cert.pdf_url && (
                        <a href={cert.pdf_url} target="_blank" rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-gray-100">
                          <Download size={14} style={{ color: '#6B7280' }} />
                        </a>
                      )}
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
