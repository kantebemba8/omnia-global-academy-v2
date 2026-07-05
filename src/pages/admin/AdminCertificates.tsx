import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { Award, Search, Download, XCircle, Eye, Filter } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function AdminCertificates() {
  const [certificates, setCertificates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterType, setFilterType] = useState('all');

  useEffect(() => {
    loadCertificates();
  }, []);

  async function loadCertificates() {
    setLoading(true);
    try {
      const token = localStorage.getItem('omnia_session_token');
      const res = await fetch(`${SUPABASE_URL}/functions/v1/dashboard-admin`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      const data = await res.json();
      setCertificates(data.certificates || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function revokeCertificate(certId: string) {
    if (!confirm('Révoquer ce certificat ? Cette action est irréversible.')) return;
    try {
      const token = localStorage.getItem('omnia_session_token');
      await fetch(`${SUPABASE_URL}/functions/v1/certificate-revoke`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ certificate_id: certId }),
      });
      loadCertificates();
    } catch (err) {
      console.error(err);
    }
  }

  const filtered = certificates.filter(c => {
    const matchSearch = !search ||
      c.student_full_name?.toLowerCase().includes(search.toLowerCase()) ||
      c.course_title?.toLowerCase().includes(search.toLowerCase()) ||
      c.omnia_certificate_id?.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'all' || c.status === filterStatus;
    const matchType = filterType === 'all' || c.template_type === filterType;
    return matchSearch && matchStatus && matchType;
  });

  return (
    <AdminLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>
              Certificats délivrés
            </h1>
            <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
              {certificates.length} certificat{certificates.length !== 1 ? 's' : ''} au total
            </p>
          </div>
        </div>

        {/* Filtres */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={16} className="absolute left-3 top-3"
              style={{ color: '#9CA3AF' }} />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par étudiant, formation, ID..."
              className="w-full pl-9 pr-4 py-2.5 border rounded-lg text-sm"
              style={{ borderColor: '#E4E7EC' }}
            />
          </div>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="px-3 py-2.5 border rounded-lg text-sm"
            style={{ borderColor: '#E4E7EC' }}>
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="revoked">Révoqué</option>
          </select>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="px-3 py-2.5 border rounded-lg text-sm"
            style={{ borderColor: '#E4E7EC' }}>
            <option value="all">Tous les types</option>
            <option value="A">Template A — Professeur</option>
            <option value="B">Template B — Établissement</option>
            <option value="C">Template C — Plateforme</option>
          </select>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-4 gap-4">
          {[
            { label: 'Total', value: certificates.length, color: '#002050' },
            { label: 'Actifs', value: certificates.filter(c => c.status === 'active').length, color: '#1E7A52' },
            { label: 'CPD certifiés', value: certificates.filter(c => c.cpd_accredited).length, color: '#BF8813' },
            { label: 'Révoqués', value: certificates.filter(c => c.status === 'revoked').length, color: '#DC2626' },
          ].map((stat, i) => (
            <div key={i} className="bg-white rounded-xl p-4 border"
              style={{ borderColor: '#E4E7EC' }}>
              <div className="text-2xl font-bold" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="text-sm mt-1" style={{ color: '#6B7280' }}>
                {stat.label}
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl border overflow-hidden"
          style={{ borderColor: '#E4E7EC' }}>
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-6 h-6 border-2 rounded-full animate-spin"
                style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Award size={32} style={{ color: '#E4E7EC' }} className="mx-auto mb-3" />
              <p style={{ color: '#6B7280' }}>Aucun certificat trouvé</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #E4E7EC', backgroundColor: '#F8F9FA' }}>
                  {['ID Certificat', 'Étudiant', 'Formation', 'Type', 'CPD', 'Date', 'Statut', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold"
                      style={{ color: '#6B7280' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((cert, i) => (
                  <tr key={cert.id}
                    style={{ borderBottom: i < filtered.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs" style={{ color: '#002050' }}>
                        {cert.omnia_certificate_id}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium" style={{ color: '#002050' }}>
                        {cert.student_full_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm" style={{ color: '#374151' }}>
                        {cert.course_title}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: cert.template_type === 'A'
                            ? 'rgba(0,32,80,0.08)'
                            : cert.template_type === 'B'
                            ? 'rgba(191,136,19,0.08)'
                            : 'rgba(30,122,82,0.08)',
                          color: cert.template_type === 'A'
                            ? '#002050'
                            : cert.template_type === 'B'
                            ? '#BF8813'
                            : '#1E7A52'
                        }}>
                        Template {cert.template_type || 'A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {cert.cpd_accredited
                        ? <span className="text-xs font-semibold" style={{ color: '#BF8813' }}>✓ CPD</span>
                        : <span className="text-xs" style={{ color: '#9CA3AF' }}>—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs" style={{ color: '#6B7280' }}>
                        {cert.issued_at
                          ? new Date(cert.issued_at).toLocaleDateString('fr-FR')
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        cert.status === 'revoked'
                          ? 'bg-red-50 text-red-600'
                          : 'bg-green-50 text-green-700'
                      }`}>
                        {cert.status === 'revoked' ? 'Révoqué' : 'Actif'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        
                          href={`/verify/${cert.omnia_certificate_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded hover:bg-gray-100"
                          title="Vérifier">
                          <Eye size={14} style={{ color: '#6B7280' }} />
                        </a>
                        {cert.pdf_url && (
                          
                            href={cert.pdf_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded hover:bg-gray-100"
                            title="Télécharger PDF">
                            <Download size={14} style={{ color: '#6B7280' }} />
                          </a>
                        )}
                        )}
                        {cert.status !== 'revoked' && (
                          <button
                            onClick={() => revokeCertificate(cert.omnia_certificate_id)}
                            className="p-1.5 rounded hover:bg-red-50"
                            title="Révoquer">
                            <XCircle size={14} style={{ color: '#DC2626' }} />
                          </button>
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
    </AdminLayout>
  );
}
