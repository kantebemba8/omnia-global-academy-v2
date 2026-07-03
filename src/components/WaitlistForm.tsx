import { useState } from 'react';
import { Mail, User, Phone, ArrowRight, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { ENDPOINTS } from '../lib/config';

type FormStatus = 'idle' | 'loading' | 'success' | 'error';

interface FormData {
  prenom: string;
  email: string;
  telephone: string;
}

interface FormErrors {
  prenom?: string;
  email?: string;
}

export function WaitlistForm() {
  const [formData, setFormData] = useState<FormData>({ prenom: '', email: '', telephone: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.prenom.trim()) {
      newErrors.prenom = 'Le prénom est requis';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!formData.email.trim()) {
      newErrors.email = "L'email est requis";
    } else if (!emailRegex.test(formData.email)) {
      newErrors.email = "Format d'email invalide";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setStatus('loading');
    setErrorMessage('');

    try {
      const response = await fetch(ENDPOINTS.waitlistSubscribe, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prenom: formData.prenom.trim(),
          email: formData.email.trim().toLowerCase(),
          telephone: formData.telephone.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setFormData({ prenom: '', email: '', telephone: '' });
      } else {
        setStatus('error');
        setErrorMessage(data.message || "Une erreur est survenue, réessayez.");
      }
    } catch {
      setStatus('error');
      setErrorMessage("Une erreur est survenue, réessayez.");
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name as keyof FormErrors]) {
      setErrors(prev => ({ ...prev, [name]: undefined }));
    }
  };

  if (status === 'success') {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{ backgroundColor: '#E4F1EA' }}
      >
        <div className="flex items-center justify-center gap-3 mb-3" style={{ color: '#1E7A52' }}>
          <CheckCircle className="w-6 h-6 flex-shrink-0" />
          <p className="text-lg font-semibold">
            Parfait ! Vous serez parmi les premiers informés du lancement.
          </p>
        </div>
        <button
          onClick={() => setStatus('idle')}
          className="text-sm font-medium underline transition-opacity hover:opacity-75"
          style={{ color: '#1E7A52' }}
        >
          Inscrire une autre personne
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="text-center mb-7">
        <h2 className="font-bold mb-2" style={{ color: '#002050', fontSize: '22px' }}>
          Soyez parmi les premiers informés
        </h2>
        <p style={{ color: '#6B7280', fontSize: '14px' }}>
          Inscrivez-vous et recevez une notification dès le lancement.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        {/* Prénom */}
        <div className="flex-1">
          <label htmlFor="prenom" className="sr-only">Prénom</label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
            <input
              type="text"
              id="prenom"
              name="prenom"
              value={formData.prenom}
              onChange={handleChange}
              placeholder="Prénom *"
              className={`w-full pl-10 pr-4 py-3 rounded-lg border bg-white text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 transition-colors ${
                errors.prenom ? 'border-error focus:ring-error/30' : 'border-border focus:ring-accent/40'
              }`}
            />
          </div>
          {errors.prenom && (
            <p className="text-error text-xs mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {errors.prenom}
            </p>
          )}
        </div>

        {/* Email */}
        <div className="flex-1">
          <label htmlFor="email" className="sr-only">Email</label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="Email *"
              className={`w-full pl-10 pr-4 py-3 rounded-lg border bg-white text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 transition-colors ${
                errors.email ? 'border-error focus:ring-error/30' : 'border-border focus:ring-accent/40'
              }`}
            />
          </div>
          {errors.email && (
            <p className="text-error text-xs mt-1 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              {errors.email}
            </p>
          )}
        </div>

        {/* Téléphone */}
        <div className="flex-1">
          <label htmlFor="telephone" className="sr-only">Téléphone (optionnel)</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted pointer-events-none" />
            <input
              type="tel"
              id="telephone"
              name="telephone"
              value={formData.telephone}
              onChange={handleChange}
              placeholder="+223 ..."
              className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-white text-text-main placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition-colors"
            />
          </div>
        </div>

        {/* Bouton */}
        <div className="flex items-start md:items-center">
          <button
            type="submit"
            disabled={status === 'loading'}
            className="w-full md:w-auto px-6 py-3 font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 whitespace-nowrap"
            style={{ backgroundColor: '#002050', color: '#FFFFFF' }}
          >
            {status === 'loading' ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Inscription...</span>
              </>
            ) : (
              <>
                <span>Me notifier au lancement</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </div>

      {status === 'error' && errorMessage && (
        <div
          className="mt-4 rounded-lg px-4 py-3 flex items-center gap-2"
          style={{ backgroundColor: '#FEE2E2', color: '#DC2626' }}
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="text-sm">{errorMessage}</span>
        </div>
      )}
    </form>
  );
}
