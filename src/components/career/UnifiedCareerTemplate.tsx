import React from 'react';
import type { CareerDocumentFull, CareerDocType } from '../../lib/careerStudioData';
import { DEFAULT_COLORS } from '../../lib/careerStudioData';
import type { DocData, DesignOptions } from './CvTemplates';
import type { LmData, LmDesign } from './LmTemplates';
import { ManualDocumentCanvas, type ManualLayout, type ManualBlock } from './ManualDocumentEditor';
import { BUILTIN_CV_LAYOUTS, BUILTIN_LM_LAYOUTS } from './EditableCareerTemplates';

function uid(prefix = 'item') { return `${prefix}_${Math.random().toString(36).slice(2, 9)}`; }
function getCvData(document: CareerDocumentFull): DocData { return document.doc_data as DocData; }
function getLmData(document: CareerDocumentFull): LmData { return document.doc_data as LmData; }

function plain(value: unknown) {
  return String(value || '').replace(/[<>]/g, '');
}

function textBlock(content: string, x: number, y: number, width: number, height: number, style: Partial<ManualBlock['style']> = {}, zIndex = 2): ManualBlock {
  return {
    id: uid('block'), type: 'text', x, y, width, height, rotation: 0, zIndex,
    content: plain(content),
    style: {
      fontFamily: 'Arial', fontSize: 12, fontWeight: 400, fontStyle: 'normal', textDecoration: 'none',
      textAlign: 'left', color: '#1f2937', backgroundColor: 'transparent', borderColor: 'transparent',
      borderWidth: 0, borderRadius: 0, lineHeight: 1.4, opacity: 1, padding: 2, ...style,
    },
  };
}

export function buildCareerTemplateLayout(document: CareerDocumentFull): ManualLayout {
  const design = document.design_options as DesignOptions;
  const builtin = document.doc_type === 'cv' ? BUILTIN_CV_LAYOUTS[document.template_key] : BUILTIN_LM_LAYOUTS[document.template_key];
  let custom: any = null;
  try { custom = JSON.parse(localStorage.getItem('omnia_career_custom_templates') || '[]').find((x:any)=>x.template_key===document.template_key)?.layout_config; } catch {}
  const cfg:any = builtin || custom || { variant:'split', primary:'#002050', accent:'#bf8813', sidebar:'#eef3f8', header:'solid' };
  const colors = { ...(design.colors || DEFAULT_COLORS), primary: design.colors?.primary || cfg.primary, accent: design.colors?.accent || cfg.accent, sidebar: design.colors?.sidebar || cfg.sidebar };
  const blocks: ManualBlock[] = [];
  const shape = (x:number,y:number,width:number,height:number,bg:string,radius=0,zIndex=1):ManualBlock => ({id:uid('shape'),type:'shape',x,y,width,height,rotation:0,zIndex,style:{backgroundColor:bg,opacity:1,borderWidth:0,borderRadius:radius}});
  const lineBlock = (x:number,y:number,width:number,color=colors.accent,height=3):ManualBlock => ({id:uid('line'),type:'line',x,y,width,height,rotation:0,zIndex:2,style:{borderColor:color,borderWidth:height,opacity:1}});
  const imageBlock = (src:string,x:number,y:number,width:number,height:number,radius:number):ManualBlock => ({id:uid('image'),type:'image',src,x,y,width,height,rotation:0,zIndex:4,style:{borderColor:colors.accent,borderWidth:3,borderRadius:radius,opacity:1}});

  if (document.doc_type === 'cv') {
    const d=getCvData(document);
    const contact=[d.contact?.email,d.contact?.phone,d.contact?.location].filter(Boolean).join(' • ');
    const skills=(d.skills||[]).map(x=>x.name).filter(Boolean).join('\n');
    const langs=(d.languages||[]).map(x=>`${x.name} — ${x.level}`).filter(Boolean).join('\n');
    const exp=(d.experiences||[]).map(e=>`${e.position}${e.company?` — ${e.company}`:''}\n${e.description||''}`).join('\n\n');
    const edu=(d.education||[]).map(e=>`${e.degree}${e.school?` — ${e.school}`:''}${e.year?` (${e.year})`:''}`).join('\n');
    const photoSrc=d.photo_url || '';
    const photoRound=cfg.variant==='creative'?20:54;

    if (cfg.variant === 'split') {
      blocks.push(shape(0,0,230,1123,colors.sidebar));
      blocks.push(shape(230,0,564,132,colors.primary));
      if(photoSrc) blocks.push(imageBlock(photoSrc,62,34,106,106,54));
      blocks.push(textBlock('CONTACT',28,175,170,24,{fontSize:12,fontWeight:700,color:colors.primary}));
      blocks.push(textBlock(contact,28,207,170,88,{fontSize:9,lineHeight:1.6,color:'#334155'}));
      blocks.push(textBlock('COMPÉTENCES',28,325,170,24,{fontSize:12,fontWeight:700,color:colors.primary}));
      blocks.push(textBlock(skills,28,358,170,180,{fontSize:9,lineHeight:1.7,color:'#334155'}));
      blocks.push(textBlock('LANGUES',28,565,170,24,{fontSize:12,fontWeight:700,color:colors.primary}));
      blocks.push(textBlock(langs,28,598,170,120,{fontSize:9,lineHeight:1.7,color:'#334155'}));
      blocks.push(textBlock(d.name||'Votre nom',270,34,470,40,{fontSize:29,fontWeight:700,color:'#fff'},4));
      blocks.push(textBlock(d.title||'Titre professionnel',270,80,470,28,{fontSize:14,fontWeight:700,color:colors.accent},4));
      let y=165;
      const add=(title:string,body:string,h:number)=>{if(!body.trim())return;blocks.push(textBlock(title,270,y,470,24,{fontSize:13,fontWeight:700,color:colors.primary}));blocks.push(lineBlock(270,y+28,76));blocks.push(textBlock(body,270,y+43,470,h,{fontSize:10,lineHeight:1.5,color:'#334155'}));y+=h+80;};
      add('PROFIL',d.summary||'',78); add('EXPÉRIENCES',exp,205); add('FORMATION',edu,110);
    } else if (cfg.variant === 'band') {
      blocks.push(shape(0,0,794,160,colors.primary));
      blocks.push(shape(0,160,794,12,colors.accent));
      if(photoSrc) blocks.push(imageBlock(photoSrc,48,28,104,104,52));
      blocks.push(textBlock(d.name||'Votre nom',180,38,560,40,{fontSize:30,fontWeight:700,color:'#fff'},4));
      blocks.push(textBlock(d.title||'Titre professionnel',180,84,560,28,{fontSize:14,fontWeight:700,color:'#fff'},4));
      blocks.push(textBlock(contact,180,120,560,22,{fontSize:9,color:'#fff'},4));
      blocks.push(shape(500,205,245,700,colors.sidebar,18));
      blocks.push(textBlock('COMPÉTENCES',526,235,190,24,{fontSize:12,fontWeight:700,color:colors.primary}));
      blocks.push(textBlock(skills,526,270,190,180,{fontSize:9,lineHeight:1.65,color:'#334155'}));
      blocks.push(textBlock('FORMATION',526,490,190,24,{fontSize:12,fontWeight:700,color:colors.primary}));
      blocks.push(textBlock(edu,526,525,190,170,{fontSize:9,lineHeight:1.55,color:'#334155'}));
      blocks.push(textBlock('LANGUES',526,725,190,24,{fontSize:12,fontWeight:700,color:colors.primary}));
      blocks.push(textBlock(langs,526,760,190,120,{fontSize:9,lineHeight:1.6,color:'#334155'}));
      blocks.push(textBlock('PROFIL',48,220,410,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(lineBlock(48,249,76));
      blocks.push(textBlock(d.summary||'',48,266,410,90,{fontSize:10,lineHeight:1.55,color:'#334155'}));
      blocks.push(textBlock('EXPÉRIENCES',48,390,410,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(lineBlock(48,419,76));
      blocks.push(textBlock(exp,48,438,410,430,{fontSize:10,lineHeight:1.5,color:'#334155'}));
    } else if (cfg.variant === 'timeline') {
      if(photoSrc) blocks.push(imageBlock(photoSrc,46,38,98,98,49));
      blocks.push(textBlock(d.name||'Votre nom',175,42,560,38,{fontSize:29,fontWeight:700,color:colors.primary},4));
      blocks.push(textBlock(d.title||'Titre professionnel',175,84,560,28,{fontSize:14,fontWeight:700,color:colors.accent},4));
      blocks.push(textBlock(contact,175,120,560,22,{fontSize:9,color:'#64748b'}));
      blocks.push(lineBlock(48,160,700,colors.accent,2));
      blocks.push(shape(520,200,225,750,colors.sidebar,20));
      blocks.push(textBlock('COMPÉTENCES',546,230,170,24,{fontSize:12,fontWeight:700,color:colors.primary}));
      blocks.push(textBlock(skills,546,265,170,190,{fontSize:9,lineHeight:1.65,color:'#334155'}));
      blocks.push(textBlock('FORMATION',546,490,170,24,{fontSize:12,fontWeight:700,color:colors.primary}));
      blocks.push(textBlock(edu,546,525,170,180,{fontSize:9,lineHeight:1.55,color:'#334155'}));
      blocks.push(textBlock('LANGUES',546,735,170,24,{fontSize:12,fontWeight:700,color:colors.primary}));
      blocks.push(textBlock(langs,546,770,170,110,{fontSize:9,lineHeight:1.6,color:'#334155'}));
      blocks.push(lineBlock(64,225,3,colors.accent,4));
      blocks.push(textBlock('PROFIL',90,205,390,24,{fontSize:13,fontWeight:700,color:colors.primary}));
      blocks.push(textBlock(d.summary||'',90,240,390,95,{fontSize:10,lineHeight:1.55,color:'#334155'}));
      blocks.push(textBlock('PARCOURS',90,370,390,24,{fontSize:13,fontWeight:700,color:colors.primary}));
      blocks.push(textBlock(exp,90,405,390,430,{fontSize:10,lineHeight:1.5,color:'#334155'}));
    } else if (cfg.variant === 'cards') {
      blocks.push(shape(34,30,726,140,colors.primary,22));
      if(photoSrc) blocks.push(imageBlock(photoSrc,58,48,104,104,52));
      blocks.push(textBlock(d.name||'Votre nom',190,55,520,38,{fontSize:29,fontWeight:700,color:'#fff'},4));
      blocks.push(textBlock(d.title||'Titre professionnel',190,98,520,26,{fontSize:14,fontWeight:700,color:colors.accent},4));
      blocks.push(textBlock(contact,190,132,520,20,{fontSize:9,color:'#fff'},4));
      blocks.push(shape(34,195,350,860,'#fff',18)); blocks.push(shape(410,195,350,400,'#fff',18)); blocks.push(shape(410,620,350,435,'#fff',18));
      blocks.push(textBlock('PROFIL',60,225,300,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(textBlock(d.summary||'',60,260,300,100,{fontSize:10,lineHeight:1.55,color:'#334155'}));
      blocks.push(textBlock('EXPÉRIENCES',60,395,300,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(textBlock(exp,60,430,300,560,{fontSize:10,lineHeight:1.5,color:'#334155'}));
      blocks.push(textBlock('COMPÉTENCES',438,225,295,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(textBlock(skills,438,260,295,260,{fontSize:10,lineHeight:1.65,color:'#334155'}));
      blocks.push(textBlock('FORMATION',438,650,295,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(textBlock(edu,438,685,295,180,{fontSize:10,lineHeight:1.55,color:'#334155'}));
      blocks.push(textBlock('LANGUES',438,890,295,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(textBlock(langs,438,925,295,100,{fontSize:10,lineHeight:1.55,color:'#334155'}));
    } else if (cfg.variant === 'creative') {
      blocks.push(shape(-120,-95,390,390,colors.primary,195));
      if(photoSrc) blocks.push(imageBlock(photoSrc,56,40,108,108,20));
      blocks.push(textBlock(d.name||'Votre nom',195,55,520,38,{fontSize:31,fontWeight:700,color:'#fff'},4));
      blocks.push(textBlock(d.title||'Titre professionnel',195,100,520,26,{fontSize:14,fontWeight:700,color:'#fff'},4));
      blocks.push(shape(40,210,235,800,colors.sidebar,24));
      blocks.push(textBlock('CONTACT',64,240,180,24,{fontSize:12,fontWeight:700,color:colors.primary})); blocks.push(textBlock(contact,64,275,180,90,{fontSize:9,lineHeight:1.6,color:'#334155'}));
      blocks.push(textBlock('COMPÉTENCES',64,395,180,24,{fontSize:12,fontWeight:700,color:colors.primary})); blocks.push(textBlock(skills,64,430,180,230,{fontSize:9,lineHeight:1.7,color:'#334155'}));
      blocks.push(textBlock('LANGUES',64,700,180,24,{fontSize:12,fontWeight:700,color:colors.primary})); blocks.push(textBlock(langs,64,735,180,120,{fontSize:9,lineHeight:1.6,color:'#334155'}));
      blocks.push(textBlock('À PROPOS',315,225,420,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(lineBlock(315,254,76)); blocks.push(textBlock(d.summary||'',315,270,420,100,{fontSize:10,lineHeight:1.55,color:'#334155'}));
      blocks.push(textBlock('EXPÉRIENCES',315,410,420,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(lineBlock(315,439,76)); blocks.push(textBlock(exp,315,458,420,360,{fontSize:10,lineHeight:1.5,color:'#334155'}));
      blocks.push(textBlock('FORMATION',315,850,420,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(lineBlock(315,879,76)); blocks.push(textBlock(edu,315,898,420,140,{fontSize:10,lineHeight:1.5,color:'#334155'}));
    } else if (cfg.variant === 'tech') {
      blocks.push(shape(0,0,230,1123,colors.sidebar)); blocks.push(shape(230,0,564,1123,'#061421'));
      if(photoSrc) blocks.push(imageBlock(photoSrc,62,42,106,106,53));
      blocks.push(textBlock('CONTACT',30,180,170,24,{fontSize:12,fontWeight:700,color:colors.accent})); blocks.push(textBlock(contact,30,215,170,95,{fontSize:9,lineHeight:1.6,color:'#e2e8f0'}));
      blocks.push(textBlock('STACK',30,345,170,24,{fontSize:12,fontWeight:700,color:colors.accent})); blocks.push(textBlock(skills,30,380,170,230,{fontSize:9,lineHeight:1.65,color:'#e2e8f0'}));
      blocks.push(textBlock('LANGUES',30,650,170,24,{fontSize:12,fontWeight:700,color:colors.accent})); blocks.push(textBlock(langs,30,685,170,120,{fontSize:9,lineHeight:1.6,color:'#e2e8f0'}));
      blocks.push(shape(270,42,470,118,'transparent',0)); blocks.push(textBlock(d.name||'Votre nom',300,65,410,38,{fontSize:30,fontWeight:700,color:'#fff'},4)); blocks.push(textBlock(d.title||'Digital • Data • Tech',300,108,410,25,{fontSize:13,fontWeight:700,color:colors.accent},4));
      blocks.push(textBlock('PROFIL',280,210,440,24,{fontSize:13,fontWeight:700,color:colors.accent})); blocks.push(textBlock(d.summary||'',280,245,440,100,{fontSize:10,lineHeight:1.55,color:'#cbd5e1'}));
      blocks.push(textBlock('EXPÉRIENCES',280,390,440,24,{fontSize:13,fontWeight:700,color:colors.accent})); blocks.push(textBlock(exp,280,425,440,390,{fontSize:10,lineHeight:1.5,color:'#cbd5e1'}));
      blocks.push(textBlock('FORMATION',280,850,440,24,{fontSize:13,fontWeight:700,color:colors.accent})); blocks.push(textBlock(edu,280,885,440,150,{fontSize:10,lineHeight:1.5,color:'#cbd5e1'}));
    } else if (cfg.variant === 'hospitality') {
      blocks.push(shape(564,0,230,1123,colors.sidebar));
      if(photoSrc) blocks.push(imageBlock(photoSrc,626,42,106,106,53));
      blocks.push(textBlock('CONTACT',594,180,170,24,{fontSize:12,fontWeight:700,color:colors.primary})); blocks.push(textBlock(contact,594,215,170,95,{fontSize:9,lineHeight:1.6,color:'#4a3326'}));
      blocks.push(textBlock('COMPÉTENCES',594,345,170,24,{fontSize:12,fontWeight:700,color:colors.primary})); blocks.push(textBlock(skills,594,380,170,230,{fontSize:9,lineHeight:1.65,color:'#4a3326'}));
      blocks.push(textBlock('LANGUES',594,650,170,24,{fontSize:12,fontWeight:700,color:colors.primary})); blocks.push(textBlock(langs,594,685,170,120,{fontSize:9,lineHeight:1.6,color:'#4a3326'}));
      blocks.push(textBlock(d.name||'Votre nom',46,42,470,38,{fontSize:30,fontWeight:700,color:colors.primary},4)); blocks.push(textBlock(d.title||'Hospitality Professional',46,86,470,26,{fontSize:14,fontWeight:700,color:colors.accent},4)); blocks.push(lineBlock(46,132,460,colors.accent,2));
      blocks.push(textBlock('PROFIL',46,180,470,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(textBlock(d.summary||'',46,215,470,100,{fontSize:10,lineHeight:1.55,color:'#4a3326'}));
      blocks.push(textBlock('EXPÉRIENCE',46,360,470,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(textBlock(exp,46,395,470,390,{fontSize:10,lineHeight:1.5,color:'#4a3326'}));
      blocks.push(textBlock('FORMATION',46,825,470,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(textBlock(edu,46,860,470,150,{fontSize:10,lineHeight:1.5,color:'#4a3326'}));
    } else if (cfg.variant === 'executive') {
      blocks.push(shape(0,0,794,160,'#111827')); blocks.push(lineBlock(0,158,794,colors.accent,4));
      blocks.push(textBlock(d.name||'Votre nom',50,42,690,40,{fontSize:32,fontWeight:700,color:'#fff'},4)); blocks.push(textBlock(d.title||'Direction • Leadership • Stratégie',50,88,690,28,{fontSize:14,fontWeight:700,color:colors.accent},4)); blocks.push(textBlock(contact,50,126,690,20,{fontSize:9,color:'#cbd5e1'},4));
      blocks.push(textBlock('PROFIL EXÉCUTIF',50,205,430,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(textBlock(d.summary||'',50,240,430,100,{fontSize:10,lineHeight:1.55,color:'#334155'}));
      blocks.push(textBlock('EXPÉRIENCE',50,380,430,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(textBlock(exp,50,415,430,470,{fontSize:10,lineHeight:1.5,color:'#334155'}));
      blocks.push(lineBlock(515,210,3,'#e5e7eb',2));
      blocks.push(textBlock('COMPÉTENCES CLÉS',545,205,190,24,{fontSize:12,fontWeight:700,color:colors.primary})); blocks.push(textBlock(skills,545,240,190,240,{fontSize:9,lineHeight:1.65,color:'#334155'}));
      blocks.push(textBlock('FORMATION',545,515,190,24,{fontSize:12,fontWeight:700,color:colors.primary})); blocks.push(textBlock(edu,545,550,190,180,{fontSize:9,lineHeight:1.55,color:'#334155'}));
      blocks.push(textBlock('LANGUES',545,765,190,24,{fontSize:12,fontWeight:700,color:colors.primary})); blocks.push(textBlock(langs,545,800,190,120,{fontSize:9,lineHeight:1.6,color:'#334155'}));
    } else {
      blocks.push(shape(36,30,722,130,colors.primary,18));
      blocks.push(textBlock(d.name||'Votre nom',64,55,470,38,{fontSize:29,fontWeight:700,color:'#fff'},4)); blocks.push(textBlock(d.title||'Titre professionnel',64,98,470,26,{fontSize:14,fontWeight:700,color:colors.accent},4)); blocks.push(textBlock(contact,560,58,160,70,{fontSize:8,textAlign:'right',color:'#fff'},4));
      blocks.push(textBlock('PROFIL',46,205,330,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(textBlock(d.summary||'',46,240,330,100,{fontSize:10,lineHeight:1.55,color:'#334155'}));
      blocks.push(textBlock('EXPÉRIENCES',46,380,330,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(textBlock(exp,46,415,330,480,{fontSize:10,lineHeight:1.5,color:'#334155'}));
      blocks.push(textBlock('COMPÉTENCES',420,205,320,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(textBlock(skills,420,240,320,230,{fontSize:10,lineHeight:1.65,color:'#334155'}));
      blocks.push(textBlock('FORMATION',420,515,320,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(textBlock(edu,420,550,320,180,{fontSize:10,lineHeight:1.55,color:'#334155'}));
      blocks.push(textBlock('LANGUES',420,770,320,24,{fontSize:13,fontWeight:700,color:colors.primary})); blocks.push(textBlock(langs,420,805,320,120,{fontSize:10,lineHeight:1.6,color:'#334155'}));
    }
  } else {
    const d=getLmData(document);
    const sender=[d.sender?.email,d.sender?.phone,d.sender?.address].filter(Boolean).join(' • ');
    const recipient=`${d.recipient?.name||''}\n${d.recipient?.company||''}\n${d.recipient?.address||''}`;
    const body=[d.intro,d.motivation,d.skills_paragraph,d.company_link,d.availability].filter(Boolean).join('\n\n');
    const signature=d.signature||d.sender?.name||'';
    if(cfg.variant==='split'){
      blocks.push(shape(0,0,170,1123,colors.primary));
      blocks.push(textBlock(d.sender?.name||'Votre nom',24,52,120,100,{fontSize:23,fontWeight:700,color:'#fff'},4)); blocks.push(lineBlock(24,170,48,colors.accent,4)); blocks.push(textBlock(sender,24,200,120,180,{fontSize:9,lineHeight:1.7,color:'#fff'},4));
      blocks.push(textBlock(recipient,220,70,250,80,{fontSize:10,lineHeight:1.5})); blocks.push(textBlock(`${d.sender?.city||''}${d.sender?.date?`, le ${d.sender.date}`:''}`,500,70,230,28,{fontSize:10,textAlign:'right'}));
      blocks.push(textBlock(`Objet : ${d.subject||''}`,220,190,520,35,{fontSize:12,fontWeight:700,color:colors.primary})); blocks.push(textBlock(d.salutation||'Madame, Monsieur,',220,250,520,32,{fontSize:11})); blocks.push(textBlock(body,220,300,520,520,{fontSize:11,lineHeight:1.65,textAlign:'justify'})); blocks.push(textBlock(d.closing||'',220,845,520,100,{fontSize:11,lineHeight:1.6})); blocks.push(textBlock(signature,500,980,230,45,{fontSize:15,fontWeight:700,fontStyle:'italic',textAlign:'right',color:colors.primary}));
    } else if(cfg.variant==='band'){
      blocks.push(shape(0,0,794,150,colors.primary)); blocks.push(shape(0,150,794,12,colors.accent));
      blocks.push(textBlock(d.sender?.name||'Votre nom',50,45,550,38,{fontSize:28,fontWeight:700,color:'#fff'},4)); blocks.push(textBlock(sender,50,95,650,24,{fontSize:9,color:'#fff'},4));
      blocks.push(textBlock(recipient,60,205,280,85,{fontSize:10,lineHeight:1.5})); blocks.push(textBlock(`${d.sender?.city||''}${d.sender?.date?`, le ${d.sender.date}`:''}`,480,205,250,30,{fontSize:10,textAlign:'right'}));
      blocks.push(textBlock(`Objet : ${d.subject||''}`,60,320,670,35,{fontSize:12,fontWeight:700,color:colors.primary})); blocks.push(textBlock(d.salutation||'Madame, Monsieur,',60,380,670,32,{fontSize:11})); blocks.push(textBlock(body,60,430,670,500,{fontSize:11,lineHeight:1.65,textAlign:'justify'})); blocks.push(textBlock(d.closing||'',60,950,670,80,{fontSize:11,lineHeight:1.6})); blocks.push(textBlock(signature,500,1040,230,40,{fontSize:15,fontWeight:700,fontStyle:'italic',textAlign:'right',color:colors.primary}));
    } else if(cfg.variant==='creative'){
      blocks.push(shape(0,0,190,1123,colors.primary)); blocks.push(shape(610,-80,300,300,colors.accent,150));
      blocks.push(textBlock(d.sender?.name||'Votre nom',28,52,130,120,{fontSize:23,fontWeight:700,color:'#fff'},4)); blocks.push(textBlock(sender,28,205,130,180,{fontSize:9,lineHeight:1.7,color:'#fff'},4));
      blocks.push(shape(220,55,520,1010,'#fff',24)); blocks.push(textBlock(recipient,255,95,230,80,{fontSize:10,lineHeight:1.5})); blocks.push(textBlock(`${d.sender?.city||''}${d.sender?.date?`, le ${d.sender.date}`:''}`,500,95,200,28,{fontSize:10,textAlign:'right'}));
      blocks.push(textBlock(`Objet : ${d.subject||''}`,255,215,445,35,{fontSize:12,fontWeight:700,color:colors.primary})); blocks.push(textBlock(d.salutation||'Madame, Monsieur,',255,275,445,32,{fontSize:11})); blocks.push(textBlock(body,255,325,445,500,{fontSize:11,lineHeight:1.65,textAlign:'justify'})); blocks.push(textBlock(d.closing||'',255,850,445,100,{fontSize:11,lineHeight:1.6})); blocks.push(textBlock(signature,470,985,230,45,{fontSize:15,fontWeight:700,fontStyle:'italic',textAlign:'right',color:colors.primary}));
    } else if(cfg.variant==='tech'){
      blocks.push(shape(0,0,794,1123,'#071a2f')); blocks.push(shape(30,30,734,1063,'#0d2944')); blocks.push(lineBlock(50,155,690,colors.accent,2));
      blocks.push(textBlock(d.sender?.name||'Votre nom',50,60,500,38,{fontSize:27,fontWeight:700,color:'#fff'},4)); blocks.push(textBlock(sender,50,108,500,22,{fontSize:9,color:'#dbeafe'},4)); blocks.push(textBlock('CANDIDATURE',600,62,130,30,{fontSize:12,fontWeight:700,color:colors.accent,textAlign:'right'},4));
      blocks.push(textBlock(recipient,60,200,260,85,{fontSize:10,lineHeight:1.5,color:'#e2e8f0'})); blocks.push(textBlock(`${d.sender?.city||''}${d.sender?.date?`, le ${d.sender.date}`:''}`,480,200,250,30,{fontSize:10,textAlign:'right',color:'#e2e8f0'}));
      blocks.push(textBlock(`Objet : ${d.subject||''}`,60,320,670,35,{fontSize:12,fontWeight:700,color:colors.accent})); blocks.push(textBlock(d.salutation||'Madame, Monsieur,',60,380,670,32,{fontSize:11,color:'#e2e8f0'})); blocks.push(textBlock(body,60,430,670,500,{fontSize:11,lineHeight:1.65,textAlign:'justify',color:'#e2e8f0'})); blocks.push(textBlock(d.closing||'',60,950,670,80,{fontSize:11,lineHeight:1.6,color:'#e2e8f0'})); blocks.push(textBlock(signature,500,1040,230,40,{fontSize:15,fontWeight:700,fontStyle:'italic',textAlign:'right',color:colors.accent}));
    } else if(cfg.variant==='executive'){
      blocks.push(shape(0,0,794,165,'#111827')); blocks.push(lineBlock(0,163,794,colors.accent,4)); blocks.push(textBlock(d.sender?.name||'Votre nom',52,52,600,38,{fontSize:28,fontWeight:700,color:'#fff'},4)); blocks.push(textBlock(sender,52,105,620,22,{fontSize:9,color:'#cbd5e1'},4));
      blocks.push(textBlock(recipient,60,220,260,85,{fontSize:10,lineHeight:1.5})); blocks.push(textBlock(`${d.sender?.city||''}${d.sender?.date?`, le ${d.sender.date}`:''}`,480,220,250,30,{fontSize:10,textAlign:'right'})); blocks.push(textBlock(`Objet : ${d.subject||''}`,60,345,670,35,{fontSize:12,fontWeight:700,color:colors.primary})); blocks.push(textBlock(d.salutation||'Madame, Monsieur,',60,405,670,32,{fontSize:11})); blocks.push(textBlock(body,60,455,670,480,{fontSize:11,lineHeight:1.65,textAlign:'justify'})); blocks.push(textBlock(d.closing||'',60,955,670,80,{fontSize:11,lineHeight:1.6})); blocks.push(textBlock(signature,500,1040,230,40,{fontSize:15,fontWeight:700,fontStyle:'italic',textAlign:'right',color:colors.primary}));
    } else {
      blocks.push(textBlock(d.sender?.name||'Votre nom',58,50,620,38,{fontSize:26,fontWeight:700,color:colors.primary},4)); blocks.push(textBlock(sender,58,100,650,22,{fontSize:9,color:'#64748b'},4)); blocks.push(lineBlock(58,140,678,colors.primary,2));
      blocks.push(textBlock(recipient,60,200,260,85,{fontSize:10,lineHeight:1.5})); blocks.push(textBlock(`${d.sender?.city||''}${d.sender?.date?`, le ${d.sender.date}`:''}`,480,200,250,30,{fontSize:10,textAlign:'right'})); blocks.push(textBlock(`Objet : ${d.subject||''}`,60,325,670,35,{fontSize:12,fontWeight:700,color:colors.primary})); blocks.push(textBlock(d.salutation||'Madame, Monsieur,',60,385,670,32,{fontSize:11})); blocks.push(textBlock(body,60,435,670,500,{fontSize:11,lineHeight:1.65,textAlign:'justify'})); blocks.push(textBlock(d.closing||'',60,955,670,80,{fontSize:11,lineHeight:1.6})); blocks.push(textBlock(signature,500,1040,230,40,{fontSize:15,fontWeight:700,fontStyle:'italic',textAlign:'right',color:colors.primary}));
    }
  }
  return {version:1,templateKey:document.template_key,page:{width:794,height:1123,background:'#fff'},blocks};
}


export function UnifiedCareerTemplatePreview({ docType, templateKey, data, design, className = '' }: {
  docType: CareerDocType;
  templateKey: string;
  data: DocData | LmData;
  design: DesignOptions | LmDesign;
  className?: string;
}) {
  const now = new Date().toISOString();
  const document = {
    id: '__preview__', title: '', doc_type: docType, template_key: templateKey,
    language: 'fr', status: 'draft', ats_score: null, target_job: null,
    application_type: null, created_at: now, updated_at: now,
    doc_data: data, design_options: design,
  } as CareerDocumentFull;
  return <ManualDocumentCanvas layout={buildCareerTemplateLayout(document)} className={className} />;
}
