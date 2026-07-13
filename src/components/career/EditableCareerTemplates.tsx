import React from 'react';
import type { DocData, DesignOptions } from './CvTemplates';
import type { LmData, LmDesign } from './LmTemplates';

export type LayoutVariant = 'split'|'band'|'minimal'|'timeline'|'cards'|'executive'|'creative'|'tech'|'academic'|'hospitality'|'qhse'|'compact';
export type TemplateLayoutConfig = {
  variant: LayoutVariant;
  primary: string;
  accent: string;
  sidebar?: string;
  header?: 'solid'|'line'|'split'|'minimal';
  photo?: boolean;
  font?: string;
};

export const BUILTIN_CV_LAYOUTS: Record<string, TemplateLayoutConfig> = {
  cv_horizon: { variant:'split', primary:'#002050', accent:'#bf8813', sidebar:'#eef3f8', header:'split', photo:true },
  cv_sahara: { variant:'band', primary:'#7a3e16', accent:'#d7a64a', sidebar:'#fbf4e8', header:'solid', photo:true },
  cv_atlas: { variant:'minimal', primary:'#16213e', accent:'#4b79a1', sidebar:'#f5f7fa', header:'line', photo:false },
  cv_kora: { variant:'timeline', primary:'#3b235f', accent:'#d2a8ff', sidebar:'#f6f0ff', header:'solid', photo:true },
  cv_nile: { variant:'cards', primary:'#064e3b', accent:'#22c55e', sidebar:'#ecfdf5', header:'split', photo:true },
  cv_executive: { variant:'executive', primary:'#111827', accent:'#b88746', sidebar:'#f3f4f6', header:'minimal', photo:false },
  cv_baobab: { variant:'creative', primary:'#7c2d12', accent:'#f59e0b', sidebar:'#fff7ed', header:'solid', photo:true },
  cv_digital: { variant:'tech', primary:'#071a2f', accent:'#00b8d9', sidebar:'#0d2944', header:'solid', photo:true },
  cv_academia: { variant:'academic', primary:'#334155', accent:'#64748b', sidebar:'#f8fafc', header:'line', photo:false },
  cv_hospitality: { variant:'hospitality', primary:'#123b55', accent:'#c6a15b', sidebar:'#edf4f7', header:'split', photo:true },
  cv_qhse: { variant:'qhse', primary:'#0f4c3a', accent:'#84cc16', sidebar:'#f1f8f4', header:'solid', photo:false },
  cv_impact: { variant:'compact', primary:'#1e3a8a', accent:'#f59e0b', sidebar:'#eff6ff', header:'line', photo:false },
};

export const BUILTIN_LM_LAYOUTS: Record<string, TemplateLayoutConfig> = {
  lm_horizon: { variant:'split', primary:'#002050', accent:'#bf8813', sidebar:'#eef3f8', header:'split' },
  lm_sahara: { variant:'band', primary:'#7a3e16', accent:'#d7a64a', sidebar:'#fbf4e8', header:'solid' },
  lm_atlas: { variant:'minimal', primary:'#16213e', accent:'#4b79a1', sidebar:'#f5f7fa', header:'line' },
  lm_kora: { variant:'creative', primary:'#3b235f', accent:'#d2a8ff', sidebar:'#f6f0ff', header:'solid' },
  lm_digital: { variant:'tech', primary:'#071a2f', accent:'#00b8d9', sidebar:'#0d2944', header:'solid' },
  lm_executive: { variant:'executive', primary:'#111827', accent:'#b88746', sidebar:'#f3f4f6', header:'minimal' },
};

function cachedConfig(key: string): TemplateLayoutConfig | null {
  try {
    const list = JSON.parse(localStorage.getItem('omnia_career_custom_templates') || '[]');
    const item = Array.isArray(list) ? list.find((x:any) => x.template_key === key) : null;
    return item?.layout_config || null;
  } catch { return null; }
}

const line = (accent:string) => <div style={{height:3,background:accent,width:54,margin:'7px 0 12px'}}/>;
const Section = ({title, accent, children}:{title:string;accent:string;children:React.ReactNode}) => <section style={{marginBottom:16}}><div style={{fontSize:10,fontWeight:800,letterSpacing:1.2,textTransform:'uppercase'}}>{title}</div>{line(accent)}{children}</section>;

function contacts(d:DocData){ return [d.contact?.email,d.contact?.phone,d.contact?.location].filter(Boolean).join(' • '); }

export function ConfigurableCvTemplate({data, design, templateKey}:{data:DocData;design:DesignOptions;templateKey:string}){
  const cfg = BUILTIN_CV_LAYOUTS[templateKey] || cachedConfig(templateKey) || BUILTIN_CV_LAYOUTS.cv_horizon;
  const primary = design?.colors?.primary || cfg.primary, accent = design?.colors?.accent || cfg.accent;
  const font = design?.font || cfg.font || 'Inter,Arial,sans-serif';
  const sidebar = cfg.sidebar || '#f4f6f8';
  const left = ['split','timeline','cards','creative','tech','hospitality'].includes(cfg.variant);
  const headerSolid = ['solid','split'].includes(cfg.header || '');
  const body = <>
    {data.summary && <Section title="Profil" accent={accent}><p style={{fontSize:10,lineHeight:1.55,color:'#334155',margin:0}}>{data.summary}</p></Section>}
    {data.experiences?.length>0 && <Section title="Expériences" accent={accent}>{data.experiences.map((e:any)=><div key={e.id} style={{marginBottom:12}}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><b style={{fontSize:11,color:primary}}>{e.position}</b><span style={{fontSize:8,color:'#64748b'}}>{e.start_date} {e.end_date?`— ${e.end_date}`:''}</span></div><div style={{fontSize:9,color:accent,fontWeight:700}}>{e.company}</div>{e.description&&<p style={{fontSize:9,lineHeight:1.45,color:'#475569',margin:'4px 0 0'}}>{e.description}</p>}</div>)}</Section>}
    {data.education?.length>0 && <Section title="Formation" accent={accent}>{data.education.map((e:any)=><div key={e.id} style={{marginBottom:9}}><b style={{fontSize:10,color:primary}}>{e.degree}</b><div style={{fontSize:9,color:'#475569'}}>{e.school} {e.year?`· ${e.year}`:''}</div></div>)}</Section>}
    {data.projects?.length>0 && <Section title="Projets" accent={accent}>{data.projects.map((p:any)=><div key={p.id} style={{marginBottom:8}}><b style={{fontSize:10}}>{p.name}</b><div style={{fontSize:9,color:'#475569'}}>{p.description}</div></div>)}</Section>}
  </>;
  const side = <div>{cfg.photo && design.photo_enabled && <div style={{width:92,height:92,borderRadius:cfg.variant==='creative'?18:'50%',background:'#dbe3ec',margin:'0 auto 20px',overflow:'hidden',border:`4px solid ${accent}`}}>{data.photo_url&&<img src={data.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}}/>}</div>}<Section title="Contact" accent={accent}><div style={{fontSize:9,lineHeight:1.7,wordBreak:'break-word'}}>{contacts(data)||'Vos coordonnées'}</div></Section>{data.skills?.length>0&&<Section title="Compétences" accent={accent}>{data.skills.map((s:any)=><div key={s.id} style={{fontSize:9,marginBottom:6}}>{s.name}<div style={{height:4,background:'rgba(148,163,184,.35)',marginTop:3,borderRadius:4}}><div style={{height:4,width:`${s.level||70}%`,background:accent,borderRadius:4}}/></div></div>)}</Section>}{data.languages?.length>0&&<Section title="Langues" accent={accent}>{data.languages.map((l:any)=><div key={l.id} style={{display:'flex',justifyContent:'space-between',fontSize:9,marginBottom:5}}><span>{l.name}</span><b>{l.level}</b></div>)}</Section>}</div>;
  return <div style={{width:794,minHeight:1123,background:'#fff',fontFamily:font,color:'#1f2937',display:'flex',position:'relative',overflow:'hidden'}}>
    {left && <aside style={{width:220,background:cfg.variant==='tech'?primary:sidebar,color:cfg.variant==='tech'?'#fff':'#1f2937',padding:'34px 22px'}}>{side}</aside>}
    <main style={{flex:1,padding:left?'0 30px 34px':'0 46px 40px'}}>
      <header style={{marginLeft:left?-30:-46,marginRight:left?-30:-46,padding:headerSolid?'34px 46px 28px':'38px 46px 24px',background:headerSolid?primary:'#fff',color:headerSolid?'#fff':primary,borderBottom:headerSolid?'none':`4px solid ${accent}`}}><div style={{fontSize:29,fontWeight:900,letterSpacing:-.5}}>{data.name||'Votre nom'}</div><div style={{fontSize:13,fontWeight:700,color:headerSolid?accent:primary,marginTop:5}}>{data.title||'Titre professionnel'}</div>{!left&&<div style={{fontSize:9,color:headerSolid?'#e2e8f0':'#64748b',marginTop:9}}>{contacts(data)}</div>}</header>
      <div style={{paddingTop:26,display:cfg.variant==='cards'?'grid':'block',gridTemplateColumns:'1fr 1fr',gap:18}}>{body}</div>
    </main>
  </div>;
}

export function ConfigurableLmTemplate({data,design,templateKey}:{data:LmData;design:LmDesign;templateKey:string}){
  const cfg=BUILTIN_LM_LAYOUTS[templateKey]||cachedConfig(templateKey)||BUILTIN_LM_LAYOUTS.lm_horizon;
  const primary=design?.colors?.primary||cfg.primary, accent=design?.colors?.accent||cfg.accent;
  const solid=['solid','split'].includes(cfg.header||'');
  const paragraphs=[data.intro,data.motivation,data.skills_paragraph,data.company_link,data.availability].filter(Boolean);
  return <div style={{width:794,minHeight:1123,background:'#fff',fontFamily:design?.font||'Inter,Arial,sans-serif',color:'#1f2937',position:'relative',overflow:'hidden'}}>
    {cfg.variant==='creative'&&<div style={{position:'absolute',right:-70,top:-70,width:220,height:220,borderRadius:'50%',background:accent,opacity:.15}}/>}
    <header style={{background:solid?primary:'#fff',color:solid?'#fff':primary,padding:'38px 52px 28px',borderBottom:`5px solid ${accent}`}}><div style={{fontSize:25,fontWeight:900}}>{data.sender?.name||'Votre nom'}</div><div style={{fontSize:10,marginTop:8,color:solid?'#e2e8f0':'#64748b'}}>{[data.sender?.email,data.sender?.phone,data.sender?.address].filter(Boolean).join(' • ')}</div></header>
    <main style={{padding:'42px 58px 50px'}}><div style={{display:'flex',justifyContent:'space-between',gap:30,fontSize:10,lineHeight:1.5}}><div>{data.recipient?.name}<br/><b>{data.recipient?.company}</b><br/>{data.recipient?.address}</div><div style={{textAlign:'right'}}>{data.sender?.city}{data.sender?.date?`, le ${data.sender.date}`:''}</div></div><div style={{marginTop:38,fontSize:12,fontWeight:800,color:primary,borderLeft:`5px solid ${accent}`,paddingLeft:12}}>Objet : {data.subject||'Objet de votre candidature'}</div><div style={{marginTop:34,fontSize:11,lineHeight:1.75,textAlign:'justify'}}><p>{data.salutation||'Madame, Monsieur,'}</p>{paragraphs.map((p,i)=><p key={i}>{p}</p>)}<p>{data.closing}</p></div><div style={{marginTop:45,textAlign:'right',fontSize:14,fontWeight:800,color:primary}}>{data.signature||data.sender?.name}</div></main>
  </div>;
}
