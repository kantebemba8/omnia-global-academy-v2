import { Link } from 'react-router-dom';
import { AdminLayout } from '../../components/AdminLayout';
import { BadgePercent, Building2, CreditCard, Gift, Landmark, Send, Wallet, Briefcase } from 'lucide-react';
const BLUE='#002050', GOLD='#BF8813', BORDER='#E4E7EC';
const cards=[
  ['/admin/monetization','Plans, abonnements & capacités','Créez les plans, leurs avantages, quotas et commissions. Les identifiants techniques sont générés par la plateforme.',Gift],
  ['/admin/marketing','Coupons & invitations gratuites','Coupons formations, accès à 100 %, attribution ciblée et licences B2B.',BadgePercent],
  ['/admin/fintech','Règles financières & parrainage','Paramètres de retrait structurés, prestataire de paiement et déclencheurs du parrainage.',Landmark],
  ['/admin/payouts','Retraits & reversements','Contrôlez les demandes, décisions, références de paiement et historique.',Wallet],
  ['/admin/structures/b2b','Contrats B2B & facturation','Devis, contrats Structures, preuves de paiement et suivi administratif.',Building2],
  ['/admin/coaching/finance','Finance Omnia Coaching','Paiements, remboursements et factures du Coaching.',CreditCard],
  ['/admin/omnia-live/finance','Finance Omnia Live','Billetterie, soldes Organisateurs, reversements et opérations Live.',Send],
  ['/admin/career-studio','Économie des jetons Career','Règles de gains, coûts, activation et journal des jetons Omnia Career.',Briefcase],
] as const;
export default function AdminFinanceCommerce(){return <AdminLayout><div className="mx-auto max-w-6xl space-y-7 px-6 py-6"><header className="border-b pb-5" style={{borderColor:BORDER}}><p className="text-xs font-bold uppercase tracking-[.16em]" style={{color:GOLD}}>Administration Omnia</p><h1 className="mt-1 text-3xl font-black" style={{color:BLUE}}>Finance & Commerce</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Un point d’entrée unique pour comprendre et piloter les revenus, plans, avantages, promotions, retraits et économies internes. Les moteurs spécialisés restent séparés pour préserver leur sécurité.</p></header><div className="grid gap-4 md:grid-cols-2">{cards.map(([path,title,description,Icon])=><Link key={path} to={path} className="group rounded-2xl border bg-white p-5 transition hover:shadow-md" style={{borderColor:BORDER}}><Icon size={22} style={{color:GOLD}}/><h2 className="mt-3 font-black" style={{color:BLUE}}>{title}</h2><p className="mt-2 text-sm leading-6 text-slate-600">{description}</p><span className="mt-4 inline-flex text-sm font-bold" style={{color:BLUE}}>Ouvrir →</span></Link>)}</div></div></AdminLayout>}
