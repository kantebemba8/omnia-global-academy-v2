import AdminOmniaLiveShell from './AdminOmniaLiveShell';

export default function AdminOmniaLiveStructures(){
 return <AdminOmniaLiveShell title="Structures Omnia Live" subtitle="Suivi de l’intégration des Structures dans Omnia Live.">
  <section className="rounded-2xl border bg-white p-6">
   <h2 className="text-lg font-bold text-[#002050]">Anciens Packs retirés</h2>
   <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Les anciens Packs Structure propres à Omnia Live ont été remis à zéro afin d’éviter un second moteur commercial. Les limites, capacités, stockage, certificats et rapports seront proposés comme avantages configurables dans le futur moteur central d’abonnements.</p>
   <p className="mt-3 text-sm text-slate-500">La gestion normale des Structures reste disponible dans l’espace Super Admin principal.</p>
  </section>
 </AdminOmniaLiveShell>
}
