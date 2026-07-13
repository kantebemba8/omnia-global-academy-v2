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
  const primary = design?.colors?.primary || cfg.primary;
  const accent = design?.colors?.accent || cfg.accent;
  const font = design?.font || cfg.font || (cfg.variant === 'academic' ? 'Georgia,serif' : 'Inter,Arial,sans-serif');
  const contactText = contacts(data) || 'Vos coordonnées';
  const photo = cfg.photo && design.photo_enabled ? <div style={{width:96,height:96,borderRadius:cfg.variant==='creative'?20:'50%',background:'#dbe3ec',overflow:'hidden',border:`4px solid ${accent}`,flexShrink:0}}>{data.photo_url&&<img src={data.photo_url} style={{width:'100%',height:'100%',objectFit:'cover'}}/>}</div> : null;
  const exp = <>{data.experiences?.map((e:any)=><div key={e.id} style={{marginBottom:14}}><div style={{display:'flex',justifyContent:'space-between',gap:12}}><b style={{fontSize:11,color:primary}}>{e.position}</b><span style={{fontSize:8,color:'#64748b'}}>{e.start_date} {e.end_date?`— ${e.end_date}`:''}</span></div><div style={{fontSize:9,color:accent,fontWeight:700}}>{e.company}</div>{e.description&&<p style={{fontSize:9,lineHeight:1.5,color:'#475569',margin:'4px 0 0'}}>{e.description}</p>}</div>)}</>;
  const edu = <>{data.education?.map((e:any)=><div key={e.id} style={{marginBottom:10}}><b style={{fontSize:10,color:primary}}>{e.degree}</b><div style={{fontSize:9,color:'#475569'}}>{e.school} {e.year?`· ${e.year}`:''}</div></div>)}</>;
  const skills = <>{data.skills?.map((x:any)=><div key={x.id} style={{fontSize:9,marginBottom:7}}><div style={{display:'flex',justifyContent:'space-between'}}><span>{x.name}</span><b>{x.level||70}%</b></div><div style={{height:4,background:'rgba(148,163,184,.28)',marginTop:3,borderRadius:4}}><div style={{height:4,width:`${x.level||70}%`,background:accent,borderRadius:4}}/></div></div>)}</>;
  const langs = <>{data.languages?.map((l:any)=><div key={l.id} style={{display:'flex',justifyContent:'space-between',fontSize:9,marginBottom:5}}><span>{l.name}</span><b>{l.level}</b></div>)}</>;

  if (cfg.variant === 'minimal') return <div style={{width:794,minHeight:1123,background:'#fff',fontFamily:font,color:'#111827',padding:'52px 64px'}}>
    <header style={{borderBottom:`2px solid ${primary}`,paddingBottom:20}}><div style={{fontSize:32,fontWeight:700,letterSpacing:-.8}}>{data.name||'Votre nom'}</div><div style={{fontSize:14,color:accent,marginTop:5}}>{data.title||'Titre professionnel'}</div><div style={{fontSize:9,color:'#64748b',marginTop:12}}>{contactText}</div></header>
    <div style={{paddingTop:28}}>{data.summary&&<Section title="Profil" accent={accent}><p style={{fontSize:10,lineHeight:1.65}}>{data.summary}</p></Section>}<Section title="Expériences" accent={accent}>{exp}</Section><div style={{display:'grid',gridTemplateColumns:'1.2fr .8fr',gap:28}}><div><Section title="Formation" accent={accent}>{edu}</Section></div><div><Section title="Compétences" accent={accent}>{skills}</Section><Section title="Langues" accent={accent}>{langs}</Section></div></div></div>
  </div>;

  if (cfg.variant === 'executive') return <div style={{width:794,minHeight:1123,background:'#111827',fontFamily:font,color:'#f8fafc'}}>
    <header style={{padding:'50px 54px 34px',borderBottom:`2px solid ${accent}`}}><div style={{fontSize:34,fontWeight:900}}>{data.name||'Votre nom'}</div><div style={{fontSize:14,color:accent,marginTop:6}}>{data.title||'Direction • Leadership • Stratégie'}</div><div style={{fontSize:9,color:'#cbd5e1',marginTop:12}}>{contactText}</div></header>
    <main style={{background:'#fff',color:'#1f2937',minHeight:930,padding:'34px 48px',display:'grid',gridTemplateColumns:'1.4fr .6fr',gap:34}}><div>{data.summary&&<Section title="Profil exécutif" accent={accent}><p style={{fontSize:10,lineHeight:1.6}}>{data.summary}</p></Section>}<Section title="Expérience" accent={accent}>{exp}</Section></div><aside style={{borderLeft:`1px solid #e5e7eb`,paddingLeft:24}}><Section title="Compétences clés" accent={accent}>{skills}</Section><Section title="Formation" accent={accent}>{edu}</Section><Section title="Langues" accent={accent}>{langs}</Section></aside></main>
  </div>;

  if (cfg.variant === 'compact') return <div style={{width:794,minHeight:1123,background:'#fff',fontFamily:font,color:'#1f2937',padding:'36px'}}>
    <header style={{background:primary,color:'#fff',borderRadius:18,padding:'26px 30px',display:'flex',justifyContent:'space-between',alignItems:'center'}}><div><div style={{fontSize:29,fontWeight:900}}>{data.name||'Votre nom'}</div><div style={{color:accent,fontSize:13,fontWeight:700}}>{data.title||'Titre professionnel'}</div></div><div style={{fontSize:8,textAlign:'right',lineHeight:1.7}}>{contactText}</div></header>
    <main style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:22,paddingTop:24}}><div>{data.summary&&<Section title="Profil" accent={accent}><p style={{fontSize:9,lineHeight:1.5}}>{data.summary}</p></Section>}<Section title="Expériences" accent={accent}>{exp}</Section></div><div><Section title="Compétences" accent={accent}>{skills}</Section><Section title="Formation" accent={accent}>{edu}</Section><Section title="Langues" accent={accent}>{langs}</Section></div></main>
  </div>;

  if (cfg.variant === 'academic') return <div style={{width:794,minHeight:1123,background:'#fff',fontFamily:'Georgia,serif',color:'#1f2937',padding:'48px 58px'}}>
    <header style={{textAlign:'center',borderBottom:`1px solid ${primary}`,paddingBottom:18}}><div style={{fontSize:30,fontWeight:700}}>{data.name||'Votre nom'}</div><div style={{fontSize:13,color:primary,marginTop:4}}>{data.title||'Enseignant • Chercheur'}</div><div style={{fontSize:9,color:'#64748b',marginTop:9}}>{contactText}</div></header>
    <main style={{paddingTop:26}}>{data.summary&&<Section title="Profil académique" accent={accent}><p style={{fontSize:10,lineHeight:1.7}}>{data.summary}</p></Section>}<Section title="Parcours académique" accent={accent}>{edu}</Section><Section title="Expérience et enseignement" accent={accent}>{exp}</Section>{data.projects?.length>0&&<Section title="Projets et publications" accent={accent}>{data.projects.map((x:any)=><div key={x.id} style={{fontSize:10,marginBottom:8}}><b>{x.name}</b><div>{x.description}</div></div>)}</Section>}</main>
  </div>;

  const rightSidebar = ['hospitality','qhse'].includes(cfg.variant);
  const darkSidebar = cfg.variant === 'tech';
  const sidebar = <aside style={{width:225,background:darkSidebar?primary:(cfg.sidebar||'#f4f6f8'),color:darkSidebar?'#fff':'#1f2937',padding:'34px 24px'}}><div style={{display:'flex',justifyContent:'center',marginBottom:20}}>{photo}</div><Section title="Contact" accent={accent}><div style={{fontSize:9,lineHeight:1.75,wordBreak:'break-word'}}>{contactText}</div></Section><Section title="Compétences" accent={accent}>{skills}</Section><Section title="Langues" accent={accent}>{langs}</Section></aside>;
  return <div style={{width:794,minHeight:1123,background:'#fff',fontFamily:font,color:'#1f2937',display:'flex',position:'relative',overflow:'hidden'}}>
    {!rightSidebar&&sidebar}
    <main style={{flex:1,padding:'0 34px 36px'}}><header style={{margin:'0 -34px 28px',padding:cfg.variant==='band'?'38px 46px 32px':'34px 42px 28px',background:cfg.variant==='creative'?`linear-gradient(135deg,${primary},${accent})`:primary,color:'#fff',position:'relative'}}>{cfg.variant==='creative'&&<div style={{position:'absolute',right:-50,top:-70,width:190,height:190,borderRadius:'50%',background:'rgba(255,255,255,.13)'}}/>}<div style={{display:'flex',alignItems:'center',gap:18}}>{cfg.variant==='band'&&photo}<div><div style={{fontSize:30,fontWeight:900}}>{data.name||'Votre nom'}</div><div style={{fontSize:13,fontWeight:700,color:accent,marginTop:4}}>{data.title||'Titre professionnel'}</div></div></div></header>{data.summary&&<Section title="Profil" accent={accent}><p style={{fontSize:10,lineHeight:1.6}}>{data.summary}</p></Section>}<div style={{display:cfg.variant==='cards'?'grid':'block',gridTemplateColumns:'1fr 1fr',gap:18}}><Section title="Expériences" accent={accent}>{exp}</Section><Section title="Formation" accent={accent}>{edu}</Section></div></main>
    {rightSidebar&&sidebar}
  </div>;
}

export function ConfigurableLmTemplate({data,design,templateKey}:{data:LmData;design:LmDesign;templateKey:string}){
  const cfg=BUILTIN_LM_LAYOUTS[templateKey]||cachedConfig(templateKey)||BUILTIN_LM_LAYOUTS.lm_horizon;
  const primary=design?.colors?.primary||cfg.primary, accent=design?.colors?.accent||cfg.accent;
  const paragraphs=[data.intro,data.motivation,data.skills_paragraph,data.company_link,data.availability].filter(Boolean);
  const sender=[data.sender?.email,data.sender?.phone,data.sender?.address].filter(Boolean).join(' • ');
  const letter=<><div style={{display:'flex',justifyContent:'space-between',gap:30,fontSize:10,lineHeight:1.5}}><div>{data.recipient?.name}<br/><b>{data.recipient?.company}</b><br/>{data.recipient?.address}</div><div style={{textAlign:'right'}}>{data.sender?.city}{data.sender?.date?`, le ${data.sender.date}`:''}</div></div><div style={{marginTop:34,fontSize:12,fontWeight:800,color:primary}}>Objet : {data.subject||'Objet de votre candidature'}</div><div style={{marginTop:28,fontSize:11,lineHeight:1.78,textAlign:'justify'}}><p>{data.salutation||'Madame, Monsieur,'}</p>{paragraphs.map((p,i)=><p key={i}>{p}</p>)}<p>{data.closing}</p></div><div style={{marginTop:38,textAlign:'right',fontSize:14,fontWeight:800,color:primary}}>{data.signature||data.sender?.name}</div></>;
  if(cfg.variant==='minimal') return <div style={{width:794,minHeight:1123,background:'#fff',fontFamily:'Georgia,serif',color:'#1f2937',padding:'58px 68px'}}><header style={{borderBottom:`1px solid ${primary}`,paddingBottom:16}}><div style={{fontSize:25,fontWeight:700}}>{data.sender?.name||'Votre nom'}</div><div style={{fontSize:9,color:'#64748b',marginTop:8}}>{sender}</div></header><main style={{paddingTop:40}}>{letter}</main></div>;
  if(cfg.variant==='executive') return <div style={{width:794,minHeight:1123,background:'#111827',fontFamily:'Inter,Arial,sans-serif',color:'#fff'}}><header style={{padding:'48px 58px',borderBottom:`2px solid ${accent}`}}><div style={{fontSize:28,fontWeight:900}}>{data.sender?.name||'Votre nom'}</div><div style={{fontSize:9,color:'#cbd5e1',marginTop:8}}>{sender}</div></header><main style={{background:'#fff',color:'#1f2937',minHeight:930,padding:'48px 62px'}}>{letter}</main></div>;
  if(cfg.variant==='creative') return <div style={{width:794,minHeight:1123,background:'#fff',fontFamily:'Inter,Arial,sans-serif',color:'#1f2937',display:'grid',gridTemplateColumns:'190px 1fr'}}><aside style={{background:`linear-gradient(180deg,${primary},${accent})`,color:'#fff',padding:'42px 24px'}}><div style={{fontSize:23,fontWeight:900}}>{data.sender?.name||'Votre nom'}</div><div style={{fontSize:9,lineHeight:1.8,marginTop:22}}>{sender}</div></aside><main style={{padding:'52px 54px'}}>{letter}</main></div>;
  if(cfg.variant==='tech') return <div style={{width:794,minHeight:1123,background:'#071a2f',fontFamily:'Inter,Arial,sans-serif',color:'#dbeafe',padding:'30px'}}><div style={{border:`1px solid ${accent}`,minHeight:1060,padding:'42px 48px',background:'#0d2944'}}><header style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',paddingBottom:22,borderBottom:`1px solid ${accent}`}}><div><div style={{fontSize:26,fontWeight:900,color:'#fff'}}>{data.sender?.name||'Votre nom'}</div><div style={{fontSize:9,marginTop:8}}>{sender}</div></div><div style={{fontSize:11,color:accent,fontWeight:800}}>CANDIDATURE</div></header><main style={{paddingTop:34,color:'#e2e8f0'}}>{letter}</main></div></div>;
  const solid=cfg.variant==='band'||cfg.variant==='split';
  return <div style={{width:794,minHeight:1123,background:'#fff',fontFamily:'Inter,Arial,sans-serif',color:'#1f2937'}}><header style={{background:solid?primary:'#fff',color:solid?'#fff':primary,padding:'42px 58px 30px',borderBottom:`5px solid ${accent}`}}><div style={{fontSize:26,fontWeight:900}}>{data.sender?.name||'Votre nom'}</div><div style={{fontSize:9,marginTop:8,color:solid?'#e2e8f0':'#64748b'}}>{sender}</div></header><main style={{padding:'44px 62px'}}>{letter}</main></div>;
}

