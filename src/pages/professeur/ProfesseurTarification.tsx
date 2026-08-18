import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../../components/DashboardLayout';
import { Download, Calculator, CheckCircle2, RefreshCcw, AlertCircle } from 'lucide-react';
import { ENDPOINTS } from '../../lib/config';
import { edgeAuthHeaders } from '../../lib/edgeAuth';

type PricingCourse = {
  id: string;
  title: string;
  pricing_status: string;
  pricing_recommended_xof?: number;
  pricing_range_min_xof?: number;
  pricing_range_max_xof?: number;
  desired_price_amount: number | null;
  admin_selected_price_source: string | null;
  admin_selected_price_xof: number | null;
  pricing_revision_comment: string | null;
};

export default function ProfesseurTarification() {
  const [courses, setCourses] = useState<PricingCourse[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyCourseId, setBusyCourseId] = useState('');
  const [comment, setComment] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const navigate = useNavigate();

  async function load() {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(ENDPOINTS.coursePricingWorkflow, { headers: edgeAuthHeaders() });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || data.error || 'Chargement impossible');
      setCourses(Array.isArray(data.courses) ? data.courses : []);
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Chargement impossible', ok: false });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function performAction(courseId: string, action: 'professor_accept' | 'professor_revision') {
    if (action === 'professor_revision' && !String(comment[courseId] || '').trim()) {
      setMessage({ text: 'Indiquez la raison de votre demande de révision.', ok: false });
      return;
    }

    setBusyCourseId(courseId);
    setMessage(null);
    try {
      const response = await fetch(ENDPOINTS.coursePricingWorkflow, {
        method: 'POST',
        headers: edgeAuthHeaders(),
        body: JSON.stringify({
          course_id: courseId,
          action,
          comment: String(comment[courseId] || '').trim() || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.error) throw new Error(data.message || data.error || 'Action impossible');

      if (action === 'professor_accept') {
        setMessage({ text: 'Prix accepté. Vérifiez puis soumettez maintenant la formation au Centre Qualité.', ok: true });
        navigate(`/professeur/courses/${courseId}/edit`);
        return;
      }

      setMessage({ text: 'Votre demande de révision a été transmise.', ok: true });
      setComment((current) => ({ ...current, [courseId]: '' }));
      await load();
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : 'Action impossible', ok: false });
    } finally {
      setBusyCourseId('');
    }
  }

  return (
    <DashboardLayout role="professeur">
      <div className="max-w-6xl mx-auto px-4 py-6 md:px-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Tarification des formations</h1>
          <p className="mt-1 text-sm text-gray-500">La recommandation V3 utilise la durée pédagogique calculée et les services réellement inclus. Votre niveau pédagogique n’influence pas le prix.</p>
        </div>

        {message && (
          <div
            role={message.ok ? 'status' : 'alert'}
            className={`flex items-start gap-2 rounded-xl border p-4 text-sm ${message.ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'}`}
          >
            {message.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden">
          <img src="/tarification-formations-infographie.svg" alt="Résumé du calcul de tarification" className="w-full h-auto" />
          <div className="flex flex-wrap gap-3 border-t border-gray-100 p-4">
            <a
              href="/guide-tarification-formations.pdf"
              download
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white"
              style={{ backgroundColor: '#002050' }}
            >
              <Download className="w-4 h-4" /> Télécharger le guide PDF
            </a>
            <Link
              to="/professeur/courses/new"
              className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: '#BF8813', color: '#BF8813' }}
            >
              <Calculator className="w-4 h-4" /> Créer une formation
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-semibold" style={{ color: '#002050' }}>Vos décisions tarifaires en attente</h2>
            <button type="button" onClick={() => void load()} disabled={loading} className="text-xs font-semibold underline disabled:opacity-50">
              Actualiser
            </button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-400 mt-4">Chargement…</p>
          ) : courses.length === 0 ? (
            <p className="text-sm text-gray-400 mt-4">Aucune décision tarifaire en attente.</p>
          ) : (
            <div className="mt-4 space-y-4">
              {courses.map((course) => {
                const busy = busyCourseId === course.id;
                return (
                  <div key={course.id} className="rounded-xl border border-gray-200 p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="font-semibold text-gray-800">{course.title}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Recommandation Omnia {(course.pricing_recommended_xof ?? 0).toLocaleString()} XOF · Fourchette {(course.pricing_range_min_xof || 0).toLocaleString()}–{(course.pricing_range_max_xof || 0).toLocaleString()} XOF · Votre prix {(course.desired_price_amount || 0).toLocaleString()} XOF
                        </p>
                      </div>
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-amber-50 text-amber-700">
                        {course.pricing_status.replaceAll('_', ' ')}
                      </span>
                    </div>

                    {course.pricing_status === 'en_attente_acceptation_prix_professeur' && (
                      <>
                        <div className="mt-4 rounded-lg bg-emerald-50 border border-emerald-100 p-3">
                          <p className="text-sm font-semibold text-emerald-800">
                            Prix retenu par Omnia : {(course.admin_selected_price_xof || 0).toLocaleString()} XOF
                          </p>
                          {course.pricing_revision_comment && <p className="text-xs text-emerald-700 mt-1">{course.pricing_revision_comment}</p>}
                        </div>

                        <div className="mt-3">
                          <label className="mb-1 block text-xs font-semibold text-gray-600" htmlFor={`revision-${course.id}`}>
                            Commentaire pour une éventuelle demande de révision
                          </label>
                          <textarea
                            id={`revision-${course.id}`}
                            rows={2}
                            value={comment[course.id] || ''}
                            onChange={(event) => setComment((current) => ({ ...current, [course.id]: event.target.value }))}
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:border-[#002050]"
                            placeholder="Expliquez le prix souhaité ou les éléments à revoir."
                          />
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void performAction(course.id, 'professor_accept')}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                            style={{ backgroundColor: '#1E7A52' }}
                          >
                            <CheckCircle2 className="w-4 h-4" /> {busy ? 'Traitement...' : 'Accepter le prix'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void performAction(course.id, 'professor_revision')}
                            disabled={busy}
                            className="inline-flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold disabled:opacity-50"
                            style={{ borderColor: '#BF8813', color: '#BF8813' }}
                          >
                            <RefreshCcw className="w-4 h-4" /> Demander une révision
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
