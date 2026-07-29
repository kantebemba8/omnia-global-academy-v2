import { useEffect, useState } from 'react';
import { Award, CheckCircle2, ShieldCheck, XCircle } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { professionalPathwaysCall } from '../../lib/professionalPathwaysApi';

const BLUE = '#002050';
const GOLD = '#BF8813';

export default function ProfessionalPathwayCredentialVerify() {
  const { verificationCode = '' } = useParams();
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    professionalPathwaysCall<any>('verify_credential', { verification_code: verificationCode })
      .then(setResult).catch(err => setError(err instanceof Error ? err.message : 'Vérification impossible.'));
  }, [verificationCode]);

  const credential = result?.credential;
  return <main className="min-h-screen bg-gray-50 p-5 md:p-10">
    <div className="mx-auto max-w-3xl bg-white p-6 shadow-sm md:p-9">
      <Link to="/" className="flex items-center gap-3"><img src="/omnia-sidebar-logo.png" alt="Omnia Global Academy" className="h-12 w-12 object-contain"/><div className="font-black" style={{color:BLUE}}>Omnia <span style={{color:GOLD}}>Global Academy</span></div></Link>
      <div className="mt-8 border-t pt-8 text-center"><ShieldCheck className="mx-auto" size={44} style={{color:GOLD}}/><p className="mt-4 text-xs font-bold uppercase tracking-[.18em]" style={{color:GOLD}}>Registre des parcours professionnels</p><h1 className="mt-2 text-3xl font-black" style={{color:BLUE}}>Vérification du credential</h1></div>
      {!result&&!error&&<p className="mt-8 text-center text-sm text-gray-500">Vérification en cours…</p>}
      {error&&<div className="mt-8 border border-red-200 bg-red-50 p-5 text-center text-red-800"><XCircle className="mx-auto"/><p className="mt-2 font-bold">Credential introuvable ou inaccessible</p><p className="mt-1 text-sm">{error}</p></div>}
      {credential&&<div className="mt-8 border p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase text-gray-500">{credential.credential_type==='professional_record'?'Relevé professionnel':'Certificat de parcours'}</p><h2 className="mt-2 text-2xl font-black" style={{color:BLUE}}>{credential.title}</h2><p className="mt-2 text-sm text-gray-600">{credential.pathway?.title}</p></div>{result.valid?<CheckCircle2 size={30} className="text-emerald-700"/>:<XCircle size={30} className="text-red-700"/>}</div><dl className="mt-6 grid gap-4 border-t pt-5 text-sm sm:grid-cols-2"><Info label="Statut" value={result.valid?'Valide':credential.status}/><Info label="Type" value={credential.pathway?.certification_type||credential.credential_type}/><Info label="Délivré le" value={new Date(credential.issued_at).toLocaleDateString('fr-FR')}/><Info label="Valide jusqu’au" value={credential.expires_at?new Date(credential.expires_at).toLocaleDateString('fr-FR'):'Sans expiration définie'}/><Info label="Code de vérification" value={credential.verification_code}/><Info label="Identifiant" value={credential.credential_uuid}/></dl><p className="mt-6 flex items-start gap-2 bg-gray-50 p-3 text-xs text-gray-600"><Award size={16} className="shrink-0"/>Cette page confirme uniquement l’état du credential enregistré dans le registre Omnia. Elle ne remplace pas les conditions d’un organisme externe lorsque le parcours comporte une reconnaissance partenaire.</p></div>}
    </div>
  </main>;
}

function Info({label,value}:{label:string;value:string}){return <div><dt className="text-xs font-bold uppercase text-gray-500">{label}</dt><dd className="mt-1 break-all font-semibold text-gray-800">{value}</dd></div>}
