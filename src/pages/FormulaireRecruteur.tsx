import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { ENDPOINTS } from '../lib/config';
import { Briefcase, CheckCircle, AlertCircle, Building2, User, Mail, Phone, FileText } from 'lucide-react';

const CONTRACT_TYPES = ['CDI', 'CDD', 'Stage', 'Freelance', 'Alternance', 'Autre'];
const CATEGORIES = ['Tech & Digital', 'Finance', 'Marketing', 'Management', 'Santé', 'Education', 'Juridique', 'Autre'];
const LEVELS = ['Bac', 'Bac+2', 'Bac+3/Licence', 'Bac+5/Master', 'Doctorat', 'Expérience professionnelle'];
const COUNTRIES = [
  { code: 'ML', name: 'Mali' }, { code: 'SN', name: 'Sénégal' }, { code: 'CI', name: "Côte d'Ivoire" },
  { code: 'BF', name: 'Burkina Faso' }, { code: 'GN', name: 'Guinée' }, { code: 'TG', name: 'Togo' },
  { code: 'BJ', name: 'Bénin' }, { code: 'NE', name: 'Niger' }, { code: 'CM', name: 'Cameroun' },
  { code: 'GH', name: 'Ghana' }, { code: 'NG', name: 'Nigeria' }, { code: 'MA', name: 'Maroc' },
  { code: 'DZ', name: 'Algérie' }, { code: 'TN', name: 'Tunisie' }, { code: 'CD', name: 'RD Congo' },
];

const FIELD = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div>
    <label className="text-xs font-semibold text-gray-600 block mb-1.5">{label}</label>
    {children}
  </div>
);

const INPUT_CLS = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 bg-white";
const SELECT_CLS = "w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-gray-400 bg-white text-gray-700";

export default function FormulaireRecruteur() {
  const [step, setStep] = useState<'form' | 'success'>('form');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [companyName, setCompanyName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [location, setLocation] = useState('');
  const [contractType, setContractType] = useState('CDI');
  const [category, setCategory] = useState('');
  const [salaryRange, setSalaryRange] = useState('');
  const [deadline, setDeadline] = useState('');
  const [requiredLevel, setRequiredLevel] = useState('');
  const [skillsInput, setSkillsInput] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim() || !contactName.trim() || !contactEmail.trim() || !jobTitle.trim() || !jobDescription.trim()) {
      setError('Veuillez remplir tous les champs obligatoires.');
      return;
    }
    if (jobDescription.length < 100) {
      setError('La description doit contenir au moins 100 caractères.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(contactEmail)) {
      setError('Adresse email invalide.');
      return;
    }
    setSubmitting(true); setError('');
    try {
      const skills = skillsInput.split(',').map(s => s.trim()).filter(Boolean);
      const res = await fetch(ENDPOINTS.jobCreateExternal, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: companyName, contact_name: contactName, contact_email: contactEmail,
          contact_phone: contactPhone || undefined, job_title: jobTitle, job_description: jobDescription,
          location, contract_type: contractType, category, salary_range: salaryRange || undefined,
          deadline: deadline || undefined, required_level: requiredLevel || undefined,
          skills_required: skills.length > 0 ? skills : undefined,
        }),
      });
      const d = await res.json();
      if (d.success) {
        setStep('success');
      } else {
        setError(d.error === 'DESCRIPTION_TOO_SHORT' ? 'Description trop courte (min 100 caractères).' : d.error || 'Erreur lors de la soumission.');
      }
    } catch { setError('Erreur réseau. Veuillez réessayer.'); }
    setSubmitting(false);
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F9FA' }}>
        <Navbar />
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="bg-white rounded-3xl border border-gray-100 shadow-sm p-12 max-w-lg w-full text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: '#E4F1EA' }}>
              <CheckCircle className="w-8 h-8" style={{ color: '#1E7A52' }} />
            </div>
            <h2 className="text-2xl font-bold mb-2" style={{ color: '#002050' }}>Offre soumise avec succès !</h2>
            <p className="text-gray-500 mb-6 text-sm leading-relaxed">
              Votre offre d'emploi est en cours de validation par notre équipe. Vous recevrez une confirmation par email dans les 24-48 heures ouvrées.
            </p>
            <div className="flex flex-col gap-3">
              <Link to="/emploi"
                className="block text-center py-3 rounded-xl text-sm font-bold text-white"
                style={{ backgroundColor: '#002050' }}>
                Voir les offres publiées
              </Link>
              <Link to="/"
                className="block text-center py-3 rounded-xl text-sm font-medium text-gray-500 border border-gray-200 hover:bg-gray-50">
                Retour à l'accueil
              </Link>
            </div>
          </div>
        </div>
        <PageFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: '#F8F9FA' }}>
      <Navbar />

      {/* Header */}
      <div className="bg-white border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-4">
            <Link to="/forum" className="hover:text-gray-600">Forum</Link>
            <span>›</span>
            <Link to="/emploi" className="hover:text-gray-600">Emploi</Link>
            <span>›</span>
            <span style={{ color: '#002050' }}>Déposer une offre</span>
          </div>
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: '#FEF9EE' }}>
              <Briefcase className="w-6 h-6" style={{ color: '#BF8813' }} />
            </div>
            <div>
              <h1 className="text-2xl font-bold" style={{ color: '#002050' }}>Déposez votre offre d'emploi</h1>
              <p className="text-sm text-gray-500 mt-1">Accédez aux profils publics disponibles sur Omnia. Votre offre sera visible après validation.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 w-full flex-1">
        <form onSubmit={submit} className="space-y-6">
          {/* Company info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <Building2 className="w-5 h-5" style={{ color: '#002050' }} />
              <h2 className="font-bold" style={{ color: '#002050' }}>Informations sur l'entreprise</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <FIELD label="Nom de l'entreprise *">
                <input value={companyName} onChange={e => setCompanyName(e.target.value)} required
                  placeholder="Ex: Omnia Tech Solutions" className={INPUT_CLS} />
              </FIELD>
              <FIELD label="Pays d'opération">
                <select className={SELECT_CLS} defaultValue="ML">
                  {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                </select>
              </FIELD>
            </div>
          </div>

          {/* Contact info */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <User className="w-5 h-5" style={{ color: '#002050' }} />
              <h2 className="font-bold" style={{ color: '#002050' }}>Contact recruteur</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <FIELD label="Nom & prénom *">
                <input value={contactName} onChange={e => setContactName(e.target.value)} required
                  placeholder="Ex: Aminata Diallo" className={INPUT_CLS} />
              </FIELD>
              <FIELD label="Email professionnel *">
                <input type="email" value={contactEmail} onChange={e => setContactEmail(e.target.value)} required
                  placeholder="rh@entreprise.com" className={INPUT_CLS} />
              </FIELD>
              <FIELD label="Téléphone (optionnel)">
                <input value={contactPhone} onChange={e => setContactPhone(e.target.value)}
                  placeholder="+223 XX XX XX XX" className={INPUT_CLS} />
              </FIELD>
            </div>
          </div>

          {/* Job details */}
          <div className="bg-white rounded-2xl border border-gray-100 p-6">
            <div className="flex items-center gap-2 mb-5">
              <FileText className="w-5 h-5" style={{ color: '#002050' }} />
              <h2 className="font-bold" style={{ color: '#002050' }}>Détails de l'offre</h2>
            </div>
            <div className="space-y-4">
              <FIELD label="Intitulé du poste *">
                <input value={jobTitle} onChange={e => setJobTitle(e.target.value)} required
                  placeholder="Ex: Développeur Web Full Stack" className={INPUT_CLS} />
              </FIELD>
              <div className="grid sm:grid-cols-2 gap-4">
                <FIELD label="Type de contrat *">
                  <select value={contractType} onChange={e => setContractType(e.target.value)} className={SELECT_CLS}>
                    {CONTRACT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </FIELD>
                <FIELD label="Secteur d'activité">
                  <select value={category} onChange={e => setCategory(e.target.value)} className={SELECT_CLS}>
                    <option value="">Choisir un secteur</option>
                    {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </FIELD>
                <FIELD label="Lieu du poste">
                  <input value={location} onChange={e => setLocation(e.target.value)}
                    placeholder="Ex: Bamako, Mali / Télétravail" className={INPUT_CLS} />
                </FIELD>
                <FIELD label="Fourchette de salaire">
                  <input value={salaryRange} onChange={e => setSalaryRange(e.target.value)}
                    placeholder="Ex: 300 000 - 500 000 XOF/mois" className={INPUT_CLS} />
                </FIELD>
                <FIELD label="Niveau d'études requis">
                  <select value={requiredLevel} onChange={e => setRequiredLevel(e.target.value)} className={SELECT_CLS}>
                    <option value="">Non spécifié</option>
                    {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                  </select>
                </FIELD>
                <FIELD label="Date limite de candidature">
                  <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)}
                    min={new Date().toISOString().split('T')[0]} className={INPUT_CLS} />
                </FIELD>
              </div>
              <FIELD label="Compétences requises (séparées par des virgules)">
                <input value={skillsInput} onChange={e => setSkillsInput(e.target.value)}
                  placeholder="Ex: React, Node.js, SQL, Gestion de projet..." className={INPUT_CLS} />
              </FIELD>
              <FIELD label={`Description du poste * (${jobDescription.length}/5000 — min 100)`}>
                <textarea value={jobDescription} onChange={e => setJobDescription(e.target.value.slice(0, 5000))}
                  rows={10} required
                  placeholder="Décrivez les missions, responsabilités, profil recherché, avantages et conditions de travail..."
                  className={`${INPUT_CLS} resize-none`} />
              </FIELD>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200" style={{ backgroundColor: '#FFFBEB' }}>
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#D97706' }} />
            <p className="text-xs text-amber-700">
              Votre offre sera examinée par notre équipe avant publication. Nous nous réservons le droit de refuser toute offre ne respectant pas nos conditions d'utilisation.
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-4 py-3 rounded-xl">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex gap-4">
            <Link to="/emploi"
              className="flex-1 py-3.5 rounded-xl text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 text-center">
              Annuler
            </Link>
            <button type="submit" disabled={submitting}
              className="flex-1 py-3.5 rounded-xl text-sm font-bold text-white disabled:opacity-60 transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#002050' }}>
              {submitting ? 'Envoi en cours…' : 'Soumettre l\'offre'}
            </button>
          </div>
        </form>
      </div>

      <PageFooter />
    </div>
  );
}
