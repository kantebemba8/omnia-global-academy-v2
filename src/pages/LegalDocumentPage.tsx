import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { PageFooter } from '../components/PageFooter';
import { getPublicSiteSettings } from '../lib/siteSettingsCache';


function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderMarkdownLike(markdown: string) {
  const safe = escapeHtml(markdown || '');
  return safe
    .replace(/^### (.*)$/gim, '<h3>$1</h3>')
    .replace(/^## (.*)$/gim, '<h2>$1</h2>')
    .replace(/^# (.*)$/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    .replace(/^- (.*)$/gim, '<li>$1</li>')
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/\n/g, '<br/>');
}

const META:Record<string,{title:string,key:string}>={
  cgu:{title:'Conditions Générales d’Utilisation',key:'cgu'},
  'mentions-legales':{title:'Mentions légales',key:'mentions_legales'},
  cookies:{title:'Politique cookies',key:'cookies'},
  cgv:{title:'Conditions Générales de Vente',key:'cgv'},
  remboursements:{title:'Politique de remboursement et annulation',key:'remboursements'},
};
export default function LegalDocumentPage(){
 const {doc='cgu'}=useParams();const meta=META[doc]||META.cgu;
 const [content,setContent]=useState(''); const [footer,setFooter]=useState<any>({});
 useEffect(()=>{let active=true;getPublicSiteSettings().then(d=>{if(!active)return;setContent(d.legal?.[meta.key]||'Document en cours de publication.');setFooter(d)}).catch(()=>{if(active)setContent('Document en cours de publication.')});return()=>{active=false}},[meta.key]);
 return <><Navbar/><main className="max-w-4xl mx-auto px-6 pt-28 pb-16"><h1 className="text-3xl font-bold mb-8" style={{color:'#002050'}}>{meta.title}</h1><article className="prose max-w-none"><div dangerouslySetInnerHTML={{ __html: `<p>${renderMarkdownLike(content)}</p>` }} /></article></main><PageFooter socialNetworks={footer.social_networks} appDownloads={footer.app_downloads}/></>;
}
