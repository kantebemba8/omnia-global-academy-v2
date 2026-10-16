/**
 * OGA interactive DOM adaptations of the 17 Reactive Resume V6 template layouts.
 * Original copyright (c) 2026 Amruth Pillai — MIT, see third_party/reactive-resume/LICENSE.
 * The source templates use React PDF/Forme; this renderer preserves their declared
 * semantic column and header structures while providing inline editing for OGA.
 * Print pagination and pixel-level PDF parity are intentionally left for LOT 3.
 */
import React from 'react';
import CareerInlineText from './CareerInlineText';
import type { DocData, DesignOptions } from './CvTemplates';
import type { LmData, LmDesign } from './LmTemplates';
import type { ReactiveResumeProfile } from '../../lib/reactiveResumeCatalog';

type Edit = (field:string,value:string)=>void;
type Colors = {primary:string;accent:string;sidebar:string;text:string;background:string};
type ReactStyle = React.CSSProperties;

function useColors(profile:ReactiveResumeProfile, design:DesignOptions|LmDesign):Colors {
  return {
    primary:design.colors?.primary || profile.primary,
    accent:design.colors?.accent || profile.accent,
    sidebar:design.colors?.sidebar || profile.sidebar,
    text:design.colors?.text || '#273342',
    background:design.colors?.background || '#ffffff',
  };
}
const editor=(field:string,value:string,onEdit?:Edit,multiline=false)=><CareerInlineText field={field} value={value||''} onChange={onEdit} multiline={multiline}/>;

function Section({id,title,children,color,profile}:{id:string;title:React.ReactNode;children:React.ReactNode;color:Colors;profile:ReactiveResumeProfile}){
  const idf=profile.id;
  const boxed=['lapras','porygon','gengar'].includes(idf);
  const underline=['bronzor','onyx','kakuna','scizor','rhyhorn'].includes(idf);
  const upper=!['meowth','smeargle','bronzor'].includes(idf);
  return <section data-career-section={id} style={{marginBottom:19,breakInside:'avoid',padding:boxed?'10px 13px':0,border:boxed?`1px solid ${color.accent}44`:undefined,borderLeft:idf==='ditgar'?`3px solid ${color.accent}`:undefined}}>
    <div style={{fontSize:11,fontWeight:800,letterSpacing:upper?1.2:.1,textTransform:upper?'uppercase':'none',color:color.primary,borderBottom:underline?`1px solid ${color.accent}`:undefined,paddingBottom:underline?5:undefined,marginBottom:9}}>{title}</div>
    {children}
  </section>;
}
function TextBlock({children,muted=false}:{children:React.ReactNode;muted?:boolean}){return <div style={{fontSize:10.5,lineHeight:1.6,color:muted?'#64748b':undefined,whiteSpace:'pre-wrap'}}>{children}</div>;}

function Picture({data,design,color,profile}:{data:DocData;design:DesignOptions;color:Colors;profile:ReactiveResumeProfile}){
  if(!design.photo_enabled||!data.photo_url)return null;
  const square=['ditgar','glalie','porygon','pikachu','scizor'].includes(profile.id);
  const radius=design.photo_shape==='rectangle'?'10%':design.photo_shape==='square'?'2%':square?'16%':'50%';
  return <div style={{height:100,width:100,overflow:'hidden',borderRadius:radius,border:`3px solid ${color.accent}`,flexShrink:0}}><img alt="Photo du CV" src={data.photo_url} style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:`${data.photo_position_x ?? 50}% ${data.photo_position_y ?? 50}%`,transform:`scale(${Math.max(1,data.photo_zoom||1)})`,transformOrigin:`${data.photo_position_x??50}% ${data.photo_position_y??50}%`}}/></div>;
}

function ContactInfo({data,onEdit}:{data:DocData;onEdit?:Edit}){
  const fields: Array<keyof DocData['contact']> = ['email','phone','location','linkedin','portfolio'];
  return <div data-career-section="profile" style={{fontSize:9,lineHeight:1.9,overflowWrap:'anywhere'}}>
    {fields.map(key => data.contact?.[key] ?
      <div key={key}>{editor(`contact.${key}`,data.contact[key] || '',onEdit)}</div> : null)}
  </div>;
}
function CvSectionContent({data,colors,profile,onEdit}:{data:DocData;colors:Colors;profile:ReactiveResumeProfile;onEdit?:Edit}){
  const exp=<Section id="experiences" title="Expériences professionnelles" color={colors} profile={profile}>{(data.experiences||[]).map(e=><div key={e.id} style={{marginBottom:13,breakInside:'avoid'}}>
    <div style={{display:'flex',gap:9,justifyContent:'space-between',alignItems:'baseline'}}><b style={{fontSize:11}}>{editor(`experience:${e.id}:position`,e.position,onEdit)}</b><span style={{fontSize:9,color:'#657083',whiteSpace:'nowrap'}}>{editor(`experience:${e.id}:start_date`,e.start_date,onEdit)}{e.end_date? <> – {editor(`experience:${e.id}:end_date`,e.end_date,onEdit)}</> : e.current?' – Aujourd’hui':''}</span></div>
    <div style={{fontSize:10,fontWeight:650,color:colors.primary}}>{editor(`experience:${e.id}:company`,e.company,onEdit)}{e.location? <> · {editor(`experience:${e.id}:location`,e.location,onEdit)}</>:null}</div>
    {!!e.description&&<TextBlock>{editor(`experience:${e.id}:description`,e.description,onEdit,true)}</TextBlock>}</div>)}</Section>;
  const edu=<Section id="education" title="Formation" color={colors} profile={profile}>{(data.education||[]).map(e=><div key={e.id} style={{marginBottom:12,breakInside:'avoid'}}><div style={{fontSize:10,fontWeight:800}}>{editor(`education:${e.id}:degree`,e.degree,onEdit)}</div><TextBlock muted>{editor(`education:${e.id}:school`,e.school,onEdit)} · {editor(`education:${e.id}:year`,e.year,onEdit)}</TextBlock></div>)}</Section>;
  const skills=<Section id="skills" title="Compétences" color={colors} profile={profile}>{(data.skills||[]).map(item=><div key={item.id} style={{marginBottom:8,fontSize:10}}>{editor(`skill:${item.id}:name`,item.name,onEdit)}</div>)}</Section>;
  const languages=<Section id="languages" title="Langues" color={colors} profile={profile}>{(data.languages||[]).map(item=><div key={item.id} style={{display:'flex',justifyContent:'space-between',gap:6,marginBottom:7,fontSize:10}}>{editor(`language:${item.id}:name`,item.name,onEdit)}<span>{editor(`language:${item.id}:level`,item.level,onEdit)}</span></div>)}</Section>;
  const certificates=(data.certifications_external?.length||data.omnia_formations?.some(x=>x.show))?<Section id="certifications" title="Certifications" color={colors} profile={profile}>
    {(data.certifications_external||[]).map(e=><div key={e.id} style={{fontSize:10,marginBottom:8}}><b>{editor(`certification:${e.id}:name`,e.name,onEdit)}</b> · {editor(`certification:${e.id}:issuer`,e.issuer,onEdit)} {editor(`certification:${e.id}:year`,e.year,onEdit)}</div>)}
    {(data.omnia_formations||[]).filter(x=>x.show).map(e=><div key={e.id} style={{fontSize:10,marginBottom:8}}>{e.title}{e.cpd_accredited?' · CPD':''}</div>)}
  </Section>:null;
  const projects=data.projects?.length?<Section id="projects" title="Projets" color={colors} profile={profile}>{data.projects.map(e=><div key={e.id} style={{marginBottom:10}}><b style={{fontSize:10}}>{editor(`project:${e.id}:name`,e.name,onEdit)}</b><TextBlock>{editor(`project:${e.id}:description`,e.description,onEdit,true)}</TextBlock>{e.technologies&&<div style={{fontSize:9,color:colors.primary}}>{editor(`project:${e.id}:technologies`,e.technologies,onEdit)}</div>}</div>)}</Section>:null;
  const interests=data.interests?.length?<Section id="interests" title="Centres d’intérêt" color={colors} profile={profile}><TextBlock>{editor('interests',data.interests.join(' · '),onEdit)}</TextBlock></Section>:null;
  const custom=(data.custom_sections||[]).filter(x=>x.visible!==false).map(x=><Section key={x.id} id={`custom:${x.id}`} title={editor(`custom:${x.id}:title`,x.title,onEdit)} color={colors} profile={profile}><TextBlock>{editor(`custom:${x.id}:content`,x.content,onEdit,true)}</TextBlock></Section>);
  const summary=(data.summary||data.objective)?<Section id="summary" title="Profil professionnel" color={colors} profile={profile}><TextBlock>{editor('summary',data.summary||data.objective||'',onEdit,true)}</TextBlock></Section>:null;
  return {exp,edu,skills,languages,certificates,projects,interests,custom,summary};
}

function FrameStyle(profile:ReactiveResumeProfile,colors:Colors,design:DesignOptions|LmDesign,letter=false):ReactStyle {
  const id=profile.id;
  const border=['porygon','lapras','scizor'].includes(id)?`4px solid ${colors.accent}`:undefined;
  return {
    width:794,minHeight:1123,boxSizing:'border-box',background:colors.background,
    color:colors.text,fontFamily:design.font&&design.font.toLowerCase().includes('georgia')?'Georgia,Times New Roman,serif':design.font&&design.font.toLowerCase().includes('arial')?'Arial,sans-serif':['kakuna','meowth','onyx','rhyhorn','scizor'].includes(id)?'Georgia,Times New Roman,serif':'Inter,Arial,sans-serif',
    border,position:'relative',overflow:'hidden',
    padding:letter?'0':'0',
  };
}
export function ReactiveResumeCv({data,design,profile,onFieldChange}:{data:DocData;design:DesignOptions;profile:ReactiveResumeProfile;onFieldChange?:Edit}){
  const colors=useColors(profile,design);
  const sections=CvSectionContent({data,colors,profile,onEdit:onFieldChange});
  const layout=profile;
  const two=layout.columns===2;
  const darkSide=['ditgar','gengar','glalie','pikachu'].includes(profile.id);
  const right=layout.sidebarSide==='right';
  const headerInSide=layout.headerPlacement==='sidebar-only';
  const headerInMain=layout.headerPlacement==='main-only';
  const mainSections=<>{sections.summary}{sections.exp}{sections.edu}{sections.certificates}{sections.projects}{sections.custom}</>;
  const sidebarPalette = darkSide ? { ...colors, primary:'#ffffff' } : colors;
  const asideContents = darkSide ? CvSectionContent({data,colors:sidebarPalette,profile,onEdit:onFieldChange}) : sections;
  const sideSections=<>{asideContents.skills}{asideContents.languages}{asideContents.interests}{data.references&&<Section id="references" title="Références" color={sidebarPalette} profile={profile}><TextBlock>{editor('references',data.references,onFieldChange,true)}</TextBlock></Section>}</>;
  const photo=<Picture data={data} design={design} color={colors} profile={profile}/>;
  const contact = <ContactInfo data={data} onEdit={onFieldChange}/>;
  const heading=(side=false)=> <header data-career-section="profile" style={{display:'flex',flexDirection:side?'column':profile.id==='azurill'?'column':'row',alignItems:profile.id==='azurill'?'center':'flex-start',gap:18,padding:side?'0 0 26px':'35px 48px 25px',borderBottom:side?undefined:`${profile.id==='bronzor'||profile.id==='onyx'?1:3}px solid ${colors.accent}`,background:side&&darkSide?colors.primary:!side&&['lapras','porygon'].includes(profile.id)?colors.sidebar:undefined,textAlign:profile.id==='azurill'?'center':'left'}}>
    {photo}
    <div style={{flex:1,minWidth:0}}><div style={{fontSize:['scizor','smeargle','meowth'].includes(profile.id)?36:30,fontWeight:800,lineHeight:1.13,color:side&&darkSide?'#fff':colors.primary}}>{editor('name',data.name,onFieldChange)}</div>
      <div style={{fontSize:13,fontWeight:700,marginTop:8,color:side&&darkSide?'#f4e6c4':colors.accent}}>{editor('title',data.title,onFieldChange)}</div>
      {!side&&<div style={{fontSize:9,marginTop:10,color:'#64748b'}}>{contact}</div>}
    </div>
  </header>;
  const aside=<aside style={{padding:headerInSide?'30px 23px':'26px 24px',background:darkSide?colors.primary:colors.sidebar,color:darkSide?'#fff':colors.text,boxSizing:'border-box',alignSelf:'stretch',minHeight:headerInSide?1123:undefined}}>
    {headerInSide&&heading(true)}
    {headerInSide&&<div style={{fontSize:9,marginBottom:20,lineHeight:1.7}}><ContactInfo data={data} onEdit={onFieldChange}/></div>}
    {sideSections}
  </aside>;
  return <div data-rr-template={profile.id} style={FrameStyle(profile,colors,design)}>
    {layout.headerPlacement==='full-width'&&heading()}
    {two?<div style={{display:'grid',gridTemplateColumns:right?'1fr 232px':'232px 1fr',minHeight:layout.headerPlacement==='full-width'?900:1123}}>
      {!right&&aside}
      <main style={{minWidth:0,padding:headerInMain?0:'30px 38px'}}>{headerInMain&&heading()}{<div style={headerInMain?{padding:'26px 36px'}:undefined}>{mainSections}</div>}</main>
      {right&&aside}
    </div>:<main style={{padding:profile.id==='smeargle'?'28px 48px':'30px 50px'}}>
      {profile.id==='smeargle'&&sections.summary&&<div style={{padding:'15px 22px',background:colors.sidebar,borderLeft:`4px solid ${colors.accent}`,marginBottom:19}}>{sections.summary}</div>}
      {profile.id==='smeargle'?<>{sections.exp}{sections.edu}{sections.certificates}{sections.projects}{sections.skills}{sections.languages}{sections.interests}{sections.custom}</>:<>{mainSections}{sideSections}</>}
    </main>}
  </div>;
}

export function ReactiveResumeLetter({data,design,profile,onFieldChange}:{data:LmData;design:LmDesign;profile:ReactiveResumeProfile;onFieldChange?:Edit}){
  const colors=useColors(profile,design);
  const sidebarHeader=profile.headerPlacement==='sidebar-only';
  const name=editor('sender.name',data.sender?.name,onFieldChange);
  const senderDetails = <>{(['email','phone','address'] as const).map(key => data.sender?.[key] ? <div key={key}>{editor(`sender.${key}`,data.sender[key],onFieldChange)}</div> : null)}</>;
  const paragraphs=([['intro',data.intro],['motivation',data.motivation],['skills_paragraph',data.skills_paragraph],['company_link',data.company_link],['availability',data.availability]] as Array<[string,string]>).filter(([,value])=>!!value);
  const letter=<main data-career-section="letter" style={{padding:'36px 56px',flex:1,boxSizing:'border-box'}}>
    <div style={{fontSize:10,lineHeight:1.7,display:'flex',justifyContent:'space-between',gap:24}}><div data-career-section="recipient"><b>{editor('recipient.name',data.recipient?.name,onFieldChange)}</b><div>{editor('recipient.company',data.recipient?.company,onFieldChange)}</div><div>{editor('recipient.address',data.recipient?.address,onFieldChange,true)}</div></div><div style={{textAlign:'right',whiteSpace:'nowrap'}}>{editor('sender.city',data.sender?.city,onFieldChange)}{data.sender?.date?', le ':''}{editor('sender.date',data.sender?.date,onFieldChange)}</div></div>
    <div style={{fontSize:13,fontWeight:800,color:colors.primary,marginTop:36,marginBottom:24,borderBottom:`1px solid ${colors.accent}`,paddingBottom:9}}>Objet : {editor('subject',data.subject,onFieldChange)}</div>
    <div style={{fontSize:11,lineHeight:1.8,whiteSpace:'pre-wrap'}}><p style={{marginBottom:21}}>{editor('salutation',data.salutation,onFieldChange)}</p>
      {paragraphs.map(([key,value])=><p key={key} style={{marginBottom:19}}>{editor(key,value,onFieldChange,true)}</p>)}
      <p style={{marginTop:22}}>{editor('closing',data.closing,onFieldChange,true)}</p></div>
    <div style={{textAlign:'right',fontSize:14,fontWeight:800,marginTop:46,color:colors.primary}}>{editor('signature',data.signature||data.sender?.name,onFieldChange)}</div>
  </main>;
  return <div data-rr-template={profile.id} data-rr-letter="true" style={FrameStyle(profile,colors,design,true)}>
    {sidebarHeader?<div style={{display:'grid',gridTemplateColumns:'190px 1fr',minHeight:1123}}>
      <aside data-career-section="sender" style={{background:colors.primary,color:'#fff',padding:'44px 21px',minWidth:0}}><div style={{fontSize:24,fontWeight:800,overflowWrap:'anywhere'}}>{name}</div><div style={{height:3,width:48,background:colors.accent,margin:'18px 0'}}/><div style={{fontSize:9,lineHeight:1.75,overflowWrap:'anywhere'}}>{senderDetails}</div></aside>
      {letter}
    </div>:<><header data-career-section="sender" style={{background:['lapras','porygon','chikorita'].includes(profile.id)?colors.sidebar:undefined,padding:'39px 54px 24px',borderBottom:`3px solid ${colors.accent}`,textAlign:profile.id==='azurill'?'center':'left'}}><div style={{color:colors.primary,fontSize:28,fontWeight:800}}>{name}</div><div style={{fontSize:9,marginTop:9}}>{senderDetails}</div></header>{letter}</>}
  </div>;
}
