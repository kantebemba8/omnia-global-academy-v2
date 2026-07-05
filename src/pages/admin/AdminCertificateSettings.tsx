import { useState, useEffect } from 'react';
import { AdminLayout } from '../../components/AdminLayout';
import { Save, Upload, RefreshCw } from 'lucide-react';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

export default function AdminCertificateSettings() {
  const [settings, setSettings] = useState({
    certificate_text_fr: 'pour avoir complété avec succès la formation',
    certificate_footer_text: 'Ce certificat est émis par Omnia Global Academy',
    certificate_numbering_prefix: 'CERT',
    allow_professor_signature: 'false',
    certificate_logo_url: '/IMG_0349.png',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string>('/IMG_0349.png');

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/site-settings-public`);
      const data = await res.json();
      setSettings(prev => ({
        ...prev,
        certificate_text_fr: data.certificate_text_fr || prev.certificate_text_fr,
        certificate_footer_text: data.certificate_footer_text || prev.certificate_footer_text,
        certificate_numbering_prefix: data.certificate_numbering_prefix || prev.certificate_numbering_prefix,
        allow_professor_signature: data.allow_professor_signature || prev.allow_professor_signature,
        certificate_logo_url: data.certificate_logo_url || prev.certificate_logo_url,
      }));
      setLogoPreview(data.certificate_logo_url || '/IMG_0349.png');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function saveSettings() {
    setSaving(true);
    setSuccess(false);
    try {
      const token = localStorage.getItem('omnia_session_token');
      const updates = Object.entries(settings).map(([key, value]) => ({ key, value }));
      await fetch(`${SUPABASE_URL}/functions/v1/admin-cms-update`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return (
    <AdminLayout>
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 rounded-full animate-spin"
          style={{ borderColor: '#002050', borderTopColor: 'transparent' }} />
      </div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className="p-6 max-w-3xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>
            Paramètres des certificats
          </h1>
          <button onClick={saveSettings} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-semibold text-white disabled:opacity-50"
            style={{ backgroundColor: '#002050' }}>
            <Save size={16} />
            {saving ? 'Enregistrement...' : 'Enregistrer'}
          </button>
        </div>

        {success && (
          <div className="p-3 rounded-lg text-sm font-medium"
            style={{ backgroundColor: '#E4F1EA', color: '#1E7A52' }}>
            ✓ Paramètres enregistrés avec succès
          </div>
        )}

        {/* Logo */}
        <div className="bg-white rounded-xl border p-6 space-y-4"
          style={{ borderColor: '#E4E7EC' }}>
          <h2 className="font-semibold" style={{ color: '#002050' }}>
            Logo sur les certificats
          </h2>
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-xl border flex items-center justify-center"
              style={{ borderColor: '#E4E7EC', backgroundColor: '#002050' }}>
              <img src={logoPreview} alt="Logo"
                className="h-16 w-16 object-contain"
                onError={() => setLogoPreview('/IMG_0349.png')} />
            </div>
            <div className="flex-1 space-y-2">
              <label className="block text-sm font-medium" style={{ color: '#002050' }}>
                URL du logo
              </label>
              <input
                type="text"
                value={settings.certificate_logo_url}
                onChange={e => {
                  setSettings(s => ({ ...s, certificate_logo_url: e.target.value }));
                  setLogoPreview(e.target.value);
                }}
                className="w-full px-3 py-2.5 border rounded-lg text-sm"
                style={{ borderColor: '#E4E7EC' }}
                placeholder="/IMG_0349.png"
              />
              <p className="text-xs" style={{ color: '#6B7280' }}>
                Entrez l'URL de votre logo (chemin relatif ou URL complète)
              </p>
            </div>
          </div>
        </div>

        {/* Textes */}
        <div className="bg-white rounded-xl border p-6 space-y-4"
          style={{ borderColor: '#E4E7EC' }}>
          <h2 className="font-semibold" style={{ color: '#002050' }}>
            Textes officiels
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5"
                style={{ color: '#002050' }}>
                Texte de complétion
              </label>
              <textarea
                value={settings.certificate_text_fr}
                onChange={e => setSettings(s => ({
                  ...s, certificate_text_fr: e.target.value
                }))}
                rows={2}
                className="w-full px-3 py-2.5 border rounded-lg text-sm"
                style={{ borderColor: '#E4E7EC' }}
              />
              <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
                Affiché après le nom de l'étudiant
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5"
                style={{ color: '#002050' }}>
                Texte de pied de page
              </label>
              <input
                type="text"
                value={settings.certificate_footer_text}
                onChange={e => setSettings(s => ({
                  ...s, certificate_footer_text: e.target.value
                }))}
                className="w-full px-3 py-2.5 border rounded-lg text-sm"
                style={{ borderColor: '#E4E7EC' }}
              />
            </div>
          </div>
        </div>

        {/* Numérotation */}
        <div className="bg-white rounded-xl border p-6 space-y-4"
          style={{ borderColor: '#E4E7EC' }}>
          <h2 className="font-semibold" style={{ color: '#002050' }}>
            Numérotation automatique
          </h2>
          <div>
            <label className="block text-sm font-medium mb-1.5"
              style={{ color: '#002050' }}>
              Préfixe des identifiants
            </label>
            <input
              type="text"
              value={settings.certificate_numbering_prefix}
              onChange={e => setSettings(s => ({
                ...s, certificate_numbering_prefix: e.target.value
              }))}
              className="w-full px-3 py-2.5 border rounded-lg text-sm"
              style={{ borderColor: '#E4E7EC' }}
              placeholder="CERT"
            />
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
              Format final : {settings.certificate_numbering_prefix}-2026-XXXXXXXXXX
            </p>
          </div>
        </div>

        {/* Signature professeur */}
        <div className="bg-white rounded-xl border p-6"
          style={{ borderColor: '#E4E7EC' }}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold" style={{ color: '#002050' }}>
                Signature du professeur
              </h2>
              <p className="text-sm mt-1" style={{ color: '#6B7280' }}>
                Autoriser les professeurs à ajouter leur signature sur les certificats Template A
              </p>
            </div>
            <input
              type="checkbox"
              checked={settings.allow_professor_signature === 'true'}
              onChange={e => setSettings(s => ({
                ...s,
                allow_professor_signature: e.target.checked ? 'true' : 'false'
              }))}
              className="w-5 h-5 rounded"
              style={{ accentColor: '#002050' }}
            />
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
