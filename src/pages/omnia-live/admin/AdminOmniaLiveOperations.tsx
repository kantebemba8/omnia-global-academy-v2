import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Ban, CheckCircle2, RotateCcw, Search, ShieldAlert } from 'lucide-react';
import { liveApi } from '../liveApi';
import { omniaDialog } from '../../../lib/omniaDialog';
import AdminOmniaLiveShell from './AdminOmniaLiveShell';

type Tab = 'refunds'|'cancellations'|'moderation';

const statusClass=(s:string)=>{
  if(['approved','processed','resolved'].includes(s)) return 'bg-emerald-50 text-emerald-700';
  if(['rejected','dismissed'].includes(s)) return 'bg-red-50 text-red-700';
  if(['pending','under_review'].includes(s)) return 'bg-amber-50 text-amber-700';
  return 'bg-slate-100 text-slate-700';
};

export default function AdminOmniaLiveOperations(){
  const [tab,setTab]=useState<Tab>('refunds');
  const [refunds,setRefunds]=useState<any[]>([]);
  const [cancellations,setCancellations]=useState<any[]>([]);
  const [reports,setReports]=useState<any[]>([]);
  const [loading,setLoading]=useState(false);
  const [message,setMessage]=useState('');
  const [query,setQuery]=useState('');

  async function load(active:Tab=tab){
    setLoading(true); setMessage('');
    try{
      if(active==='refunds'){
        const r=await liveApi('refunds_admin_queue');
        setRefunds(r.refunds||[]);
      }else if(active==='cancellations'){
        const r=await liveApi('cancellation_admin_queue');
        setCancellations(r.requests||[]);
      }else{
        const r=await liveApi('admin_reports');
        setReports(r.reports||[]);
      }
    }catch(e){
      setMessage(e instanceof Error?e.message:'Erreur de chargement');
    }finally{setLoading(false)}
  }

  useEffect(()=>{load(tab)},[tab]);

  async function refundDecision(row:any,decision:string){
    let amount:number|undefined;
    if(decision==='partially_approved'){
      const a=await omniaDialog({
        title:'Remboursement partiel',
        message:'Saisissez le montant à approuver.',
        confirmLabel:'Valider',
        inputLabel:'Montant',
        inputRequired:true,
      });
      if(!a.confirmed)return;
      amount=Number(a.value);
      if(!Number.isFinite(amount)||amount<=0){setMessage('Montant invalide.');return}
    }

    const needsReason=['approved','partially_approved','rejected'].includes(decision);
    let reason='';
    if(needsReason){
      const r=await omniaDialog({
        title:decision==='rejected'?'Refuser le remboursement':'Décision de remboursement',
        message:'La décision sera enregistrée dans l’historique.',
        confirmLabel:decision==='rejected'?'Refuser':'Valider',
        danger:decision==='rejected',
        inputLabel:'Motif / note',
        inputRequired:true,
      });
      if(!r.confirmed)return;
      reason=r.value;
    }

    try{
      await liveApi('refund_admin_decision',{method:'POST',body:JSON.stringify({
        refund_id:row.id,decision,approved_amount:amount,decision_reason:reason
      })});
      await load('refunds');
    }catch(e){setMessage(e instanceof Error?e.message:'Erreur')}
  }

  async function cancellationDecision(row:any,decision:string){
    let reason='';
    if(['approved','rejected'].includes(decision)){
      const r=await omniaDialog({
        title:decision==='rejected'?'Refuser la demande':'Approuver la demande',
        message:row.request_type==='reschedule'?'Cette décision concerne un report de date.':'Cette décision concerne une annulation.',
        confirmLabel:decision==='rejected'?'Refuser':'Approuver',
        danger:decision==='rejected',
        inputLabel:'Motif / note',
        inputRequired:true,
      });
      if(!r.confirmed)return;
      reason=r.value;
    }else if(decision==='processed'){
      const r=await omniaDialog({
        title:'Appliquer la décision',
        message:'Confirmez l’application définitive de cette annulation ou de ce report.',
        confirmLabel:'Appliquer',
      });
      if(!r.confirmed)return;
    }

    try{
      await liveApi('cancellation_admin_decision',{method:'POST',body:JSON.stringify({
        request_id:row.id,decision,reason
      })});
      await load('cancellations');
    }catch(e){setMessage(e instanceof Error?e.message:'Erreur')}
  }

  async function moderationDecision(row:any,status:string){
    let resolution='';
    if(['resolved','dismissed'].includes(status)){
      const r=await omniaDialog({
        title:status==='resolved'?'Résoudre le signalement':'Classer le signalement',
        message:'La décision sera conservée dans l’historique de modération.',
        confirmLabel:status==='resolved'?'Résoudre':'Classer',
        inputLabel:'Résolution / note',
        inputRequired:true,
      });
      if(!r.confirmed)return;
      resolution=r.value;
    }
    try{
      await liveApi('admin_report_decision',{method:'POST',body:JSON.stringify({
        report_id:row.id,status,resolution
      })});
      await load('moderation');
    }catch(e){setMessage(e instanceof Error?e.message:'Erreur')}
  }

  const q=query.trim().toLowerCase();
  const filteredRefunds=useMemo(()=>refunds.filter(r=>!q||[
    r.event_title,r.user_name,r.reason_details,r.reason_code,r.status
  ].some(v=>String(v||'').toLowerCase().includes(q))),[refunds,q]);
  const filteredCancels=useMemo(()=>cancellations.filter(r=>!q||[
    r.event_title,r.user_name,r.reason_details,r.request_type,r.status
  ].some(v=>String(v||'').toLowerCase().includes(q))),[cancellations,q]);
  const filteredReports=useMemo(()=>reports.filter(r=>!q||[
    r.target_title,r.user_name,r.reason,r.report_type,r.status
  ].some(v=>String(v||'').toLowerCase().includes(q))),[reports,q]);

  return <AdminOmniaLiveShell title="Opérations" subtitle="Traitez les remboursements, annulations, reports et signalements sans quitter cette page.">
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
          <button onClick={()=>setTab('refunds')} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${tab==='refunds'?'bg-white text-[#002050] shadow-sm':'text-slate-500'}`}>
            <RotateCcw size={16}/> Remboursements
          </button>
          <button onClick={()=>setTab('cancellations')} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${tab==='cancellations'?'bg-white text-[#002050] shadow-sm':'text-slate-500'}`}>
            <Ban size={16}/> Annulations & reports
          </button>
          <button onClick={()=>setTab('moderation')} className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold ${tab==='moderation'?'bg-white text-[#002050] shadow-sm':'text-slate-500'}`}>
            <ShieldAlert size={16}/> Modération
          </button>
        </div>

        <label className="relative">
          <Search size={16} className="absolute left-3 top-3 text-slate-400"/>
          <input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher..." className="rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm"/>
        </label>
      </div>

      {message&&<div className="border-b border-slate-100 bg-red-50 px-5 py-3 text-sm text-red-700">{message}</div>}
      {loading&&<div className="px-5 py-10 text-center text-slate-500">Chargement...</div>}

      {!loading&&tab==='refunds'&&<div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
            <th className="px-5 py-3">Événement</th><th className="px-4 py-3">Participant</th><th className="px-4 py-3">Montant</th><th className="px-4 py-3">Motif</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3 text-right">Actions</th>
          </tr></thead>
          <tbody>
            {filteredRefunds.map(r=><tr key={r.id} className="border-t border-slate-100">
              <td className="px-5 py-4 font-bold text-[#002050]">{r.event_title||'Événement supprimé'}</td>
              <td className="px-4 py-4">{r.user_name||r.user_email||'—'}</td>
              <td className="px-4 py-4 font-semibold">{Number(r.requested_amount||0).toLocaleString()} {r.currency||''}</td>
              <td className="max-w-[260px] px-4 py-4 text-slate-600">{r.reason_details||r.reason_code||'—'}</td>
              <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(r.status)}`}>{r.status}</span></td>
              <td className="px-4 py-4"><div className="flex justify-end gap-2">
                {r.status==='pending'&&<button onClick={()=>refundDecision(r,'under_review')} className="rounded-lg border px-3 py-2">Examiner</button>}
                {['pending','under_review'].includes(r.status)&&<>
                  <button onClick={()=>refundDecision(r,'approved')} className="rounded-lg bg-[#002050] px-3 py-2 font-bold text-white">Approuver</button>
                  <button onClick={()=>refundDecision(r,'partially_approved')} className="rounded-lg border px-3 py-2">Partiel</button>
                  <button onClick={()=>refundDecision(r,'rejected')} className="rounded-lg border border-red-300 px-3 py-2 text-red-700">Refuser</button>
                </>}
                {['approved','partially_approved'].includes(r.status)&&<button onClick={()=>refundDecision(r,'processed')} className="rounded-lg border border-emerald-300 px-3 py-2 text-emerald-700">Marquer traité</button>}
              </div></td>
            </tr>)}
            {!filteredRefunds.length&&<tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">Aucune demande de remboursement.</td></tr>}
          </tbody>
        </table>
      </div>}

      {!loading&&tab==='cancellations'&&<div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
            <th className="px-5 py-3">Événement</th><th className="px-4 py-3">Demandeur</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Motif</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3 text-right">Actions</th>
          </tr></thead>
          <tbody>
            {filteredCancels.map(r=><tr key={r.id} className="border-t border-slate-100">
              <td className="px-5 py-4 font-bold text-[#002050]">{r.event_title||'Événement'}</td>
              <td className="px-4 py-4">{r.user_name||r.requested_by_name||'—'}</td>
              <td className="px-4 py-4">{r.request_type==='reschedule'?'Report':'Annulation'}</td>
              <td className="max-w-[260px] px-4 py-4 text-slate-600">{r.reason_details||r.reason_code||'—'}</td>
              <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(r.status)}`}>{r.status}</span></td>
              <td className="px-4 py-4"><div className="flex justify-end gap-2">
                {r.status==='pending'&&<button onClick={()=>cancellationDecision(r,'under_review')} className="rounded-lg border px-3 py-2">Examiner</button>}
                {['pending','under_review'].includes(r.status)&&<>
                  <button onClick={()=>cancellationDecision(r,'approved')} className="rounded-lg bg-[#002050] px-3 py-2 font-bold text-white">Approuver</button>
                  <button onClick={()=>cancellationDecision(r,'rejected')} className="rounded-lg border border-red-300 px-3 py-2 text-red-700">Refuser</button>
                </>}
                {r.status==='approved'&&<button onClick={()=>cancellationDecision(r,'processed')} className="rounded-lg border border-emerald-300 px-3 py-2 text-emerald-700">Appliquer</button>}
              </div></td>
            </tr>)}
            {!filteredCancels.length&&<tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">Aucune demande d’annulation ou de report.</td></tr>}
          </tbody>
        </table>
      </div>}

      {!loading&&tab==='moderation'&&<div className="overflow-x-auto">
        <table className="w-full min-w-[880px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr>
            <th className="px-5 py-3">Contenu</th><th className="px-4 py-3">Signalé par</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Motif</th><th className="px-4 py-3">Statut</th><th className="px-4 py-3 text-right">Actions</th>
          </tr></thead>
          <tbody>
            {filteredReports.map(r=><tr key={r.id} className="border-t border-slate-100">
              <td className="px-5 py-4 font-bold text-[#002050]">{r.target_title||'Signalement'}</td>
              <td className="px-4 py-4">{r.user_name||r.user_email||'—'}</td>
              <td className="px-4 py-4">{r.report_type||'—'}</td>
              <td className="max-w-[280px] px-4 py-4 text-slate-600">{r.reason||'—'}</td>
              <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass(r.status)}`}>{r.status}</span></td>
              <td className="px-4 py-4"><div className="flex justify-end gap-2">
                {r.status==='open'&&<button onClick={()=>moderationDecision(r,'under_review')} className="rounded-lg border px-3 py-2">Examiner</button>}
                {['open','under_review'].includes(r.status)&&<>
                  <button onClick={()=>moderationDecision(r,'resolved')} className="rounded-lg bg-[#002050] px-3 py-2 font-bold text-white">Résoudre</button>
                  <button onClick={()=>moderationDecision(r,'dismissed')} className="rounded-lg border px-3 py-2">Classer</button>
                </>}
              </div></td>
            </tr>)}
            {!filteredReports.length&&<tr><td colSpan={6} className="px-5 py-10 text-center text-slate-500">Aucun signalement.</td></tr>}
          </tbody>
        </table>
      </div>}
    </div>
  </AdminOmniaLiveShell>
}
