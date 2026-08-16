import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { PDFDocument, StandardFonts, rgb } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.3";
import { createSignedObjectUrl, downloadStoredValue, parseStorageLocator, signCertificatePdf, storageRef } from "../_shared/protected-storage.ts";

import { getActiveOmniaSessionResult, isOmniaInternalRequest, omniaInternalHeaders } from "../_shared/omnia-auth.ts";
const corsHeaders={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,Authorization,X-Client-Info,Apikey,x-omnia-session-token"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders,"Content-Type":"application/json"}});
const BLUE="#002050",GOLD="#BF8813",WHITE="#FFFFFF",GREY="#667085";

type AssetSnapshot={original_url:string|null;snapshot_url:string|null;storage_path:string|null;mime_type:string|null;sha256:string|null;bytes?:Uint8Array|null};
type AccreditationSnapshot={id:string;organization_name:string;certification_name:string;certification_code?:string|null;credit_value?:number|null;credit_unit?:string|null;verification_url?:string|null;logo?:AssetSnapshot|null;signature?:AssetSnapshot|null;stamp?:AssetSnapshot|null;display_order:number;permission_snapshot:Record<string,unknown>};

async function verifySession(sb:any,token:string){
 const normalized=token.replace(/^Bearer\s+/i,"").trim();if(!normalized)return null;
 const {data:sess}=await getActiveOmniaSessionResult(sb, normalized);
 if(sess?.user_id)return sess.user_id;
 const {data}=await sb.auth.getUser(normalized);return data?.user?.id||null;
}
async function sha256(bytes:Uint8Array){const hash=await crypto.subtle.digest("SHA-256",bytes);return Array.from(new Uint8Array(hash)).map(v=>v.toString(16).padStart(2,"0")).join("");}
async function uniqueCertId(sb:any){const year=new Date().getFullYear();const chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789";for(let i=0;i<30;i++){const suffix=Array.from({length:10},()=>chars[Math.floor(Math.random()*chars.length)]).join("");const id=`CERT-${year}-${suffix}`;const {data}=await sb.from("certificates").select("id").eq("omnia_certificate_id",id).maybeSingle();if(!data)return id;}throw new Error("CERTIFICATE_ID_GENERATION_FAILED");}
function safeText(value:unknown){return String(value??"").replace(/[\r\n\t]+/g," ").replace(/\s+/g," ").trim();}
function hex(value:unknown,fallback:string){const text=String(value||"");return /^#[0-9a-f]{6}$/i.test(text)?text:fallback;}
function pdfColor(value:string){const v=hex(value,BLUE).slice(1);return rgb(parseInt(v.slice(0,2),16)/255,parseInt(v.slice(2,4),16)/255,parseInt(v.slice(4,6),16)/255);}
function extForMime(mime:string){if(mime.includes("png"))return"png";if(mime.includes("jpeg")||mime.includes("jpg"))return"jpg";if(mime.includes("webp"))return"webp";if(mime.includes("svg"))return"svg";return"bin";}
function resolveUrl(raw:string,appUrl:string){
 if(!raw)return"";
 if(/^https?:\/\//i.test(raw))return raw;
 if(raw.startsWith("/"))return`${appUrl.replace(/\/$/,"")}${raw}`;
 return"";
}
function unsafeIpv4(hostname:string){
 const parts=hostname.split(".");if(parts.length!==4||parts.some(part=>!/^\d{1,3}$/.test(part)))return false;
 const octets=parts.map(Number);if(octets.some(value=>value<0||value>255))return true;
 const [a,b]=octets;
 return a===0||a===10||a===127||a>=224||
  (a===100&&b>=64&&b<=127)||
  (a===169&&b===254)||
  (a===172&&b>=16&&b<=31)||
  (a===192&&(b===0||b===168))||
  (a===198&&(b===18||b===19));
}
function unsafeAssetHost(hostname:string){
 const host=hostname.toLowerCase().replace(/^\[|\]$/g,"");
 if(!host||host==="localhost"||host.endsWith(".localhost")||host.endsWith(".local")||host.endsWith(".internal")||host.endsWith(".lan")||host.endsWith(".home.arpa"))return true;
 if(unsafeIpv4(host))return true;
 if(host.includes(":")){
  const normalized=host.toLowerCase();
  if(normalized==="::"||normalized==="::1"||normalized.startsWith("fc")||normalized.startsWith("fd")||normalized.startsWith("fe8")||normalized.startsWith("fe9")||normalized.startsWith("fea")||normalized.startsWith("feb"))return true;
  if(normalized.startsWith("::ffff:"))return unsafeIpv4(normalized.slice(7));
 }
 return false;
}
function safeAssetUrl(raw:string,appUrl:string){
 const resolved=resolveUrl(raw,appUrl);if(!resolved)return"";
 try{
  const url=new URL(resolved);
  if(url.protocol!=="https:"||url.username||url.password||unsafeAssetHost(url.hostname))return"";
  if(url.port&&url.port!=="443")return"";
  return url.toString();
 }catch{return"";}
}
async function snapshotAsset(sb:any,rawUrl:unknown,certificateUuid:string,label:string,appUrl:string):Promise<AssetSnapshot|null>{
 const raw=safeText(rawUrl);if(!raw)return null;
 try{
  const internal=parseStorageLocator(raw);
  let sourceBytes:Uint8Array|null=null,mime="",original=raw;
  if(internal){const stored=await downloadStoredValue(sb,raw);if(!stored)return{original_url:raw,snapshot_url:null,storage_path:null,mime_type:null,sha256:null};sourceBytes=stored.bytes;mime=stored.mimeType;}
  else{
   original=safeAssetUrl(raw,appUrl);if(!original)return null;
   const response=await fetch(original,{signal:AbortSignal.timeout(12000),redirect:"manual"});
   if(response.status>=300&&response.status<400)return{original_url:original,snapshot_url:null,storage_path:null,mime_type:null,sha256:null};
   if(!response.ok)return{original_url:original,snapshot_url:null,storage_path:null,mime_type:null,sha256:null};
   const declaredLength=Number(response.headers.get("content-length")||0);if(declaredLength>8*1024*1024)return{original_url:original,snapshot_url:null,storage_path:null,mime_type:null,sha256:null};
   mime=(response.headers.get("content-type")||"").split(";")[0].toLowerCase();sourceBytes=new Uint8Array(await response.arrayBuffer());
  }
  if(!["image/png","image/jpeg","image/jpg","image/webp","image/svg+xml"].includes(mime))return{original_url:original,snapshot_url:null,storage_path:null,mime_type:mime||null,sha256:null};
  const bytes=sourceBytes;if(!bytes||!bytes.length||bytes.length>8*1024*1024)return{original_url:original,snapshot_url:null,storage_path:null,mime_type:mime,sha256:null};
  const digest=await sha256(bytes);const path=`snapshots/${certificateUuid}/${label}-${digest.slice(0,12)}.${extForMime(mime)}`;
  const {error}=await sb.storage.from("certificates").upload(path,bytes,{contentType:mime,upsert:true});if(error)throw error;
  return{original_url:original,snapshot_url:storageRef("certificates",path),storage_path:path,mime_type:mime,sha256:digest,bytes};
 }catch{return{original_url:raw,snapshot_url:null,storage_path:null,mime_type:null,sha256:null};}
}
async function embedAsset(pdf:PDFDocument,asset?:AssetSnapshot|null){if(!asset?.bytes||!asset.mime_type)return null;try{if(asset.mime_type.includes("png"))return await pdf.embedPng(asset.bytes);if(asset.mime_type.includes("jpeg")||asset.mime_type.includes("jpg"))return await pdf.embedJpg(asset.bytes);}catch{}return null;}
function fontText(font:any,value:unknown){const source=safeText(value).replace(/[’‘]/g,"'").replace(/[“”]/g,'"').replace(/[–—]/g,'-').replace(/…/g,'...').replace(/•/g,'-');let output="";for(const char of Array.from(source)){try{font.encodeText(char);output+=char;}catch{const fallback=char.normalize("NFD").replace(/[\u0300-\u036f]/g,"");if(fallback&&fallback!==char){for(const candidate of Array.from(fallback)){try{font.encodeText(candidate);output+=candidate;}catch{output+="?";}}}else output+="?";}}return output;}
function fitSize(font:any,text:string,maxWidth:number,start:number,min=8){const clean=fontText(font,text);let size=start;while(size>min&&font.widthOfTextAtSize(clean,size)>maxWidth)size-=.5;return size;}
function drawCentered(page:any,font:any,text:string,y:number,maxWidth:number,size:number,color:any){const clean=fontText(font,text);const finalSize=fitSize(font,clean,maxWidth,size);const width=font.widthOfTextAtSize(clean,finalSize);page.drawText(clean,{x:(page.getWidth()-width)/2,y,size:finalSize,font,color});}
async function resolveTemplate(sb:any,course:any,language:string,issuerScope:string){
 const {data:templates,error}=await sb.from("certificate_templates").select("*").eq("document_type","completion_certificate").eq("source_type","course").eq("is_active",true);if(error)throw error;
 const {data:assignments}=await sb.from("certificate_template_assignments").select("*").order("priority");
 const matching=(assignments||[]).filter((a:any)=>(!a.course_id||a.course_id===course.id)&&(!a.creator_role||a.creator_role===issuerScope)&&(!a.structure_id||a.structure_id===course.establishment_id));
 for(const assignment of matching){const template=(templates||[]).find((t:any)=>t.id===assignment.template_id);if(template&&(template.language_code===language||template.language_code==='fr'))return template;}
 return (templates||[]).find((t:any)=>t.issuer_scope===issuerScope&&t.language_code===language)||
  (templates||[]).find((t:any)=>t.issuer_scope===issuerScope&&t.language_code==='fr')||
  (templates||[]).find((t:any)=>t.issuer_scope==='platform'&&t.language_code===language&&t.is_default)||
  (templates||[]).find((t:any)=>t.issuer_scope==='platform'&&t.language_code==='fr'&&t.is_default)||
  (templates||[])[0]||null;
}
async function buildPdf(input:any){
 const pdf=await PDFDocument.create();pdf.setTitle(input.course_title);pdf.setAuthor("Omnia Global Academy");pdf.setSubject(`Certificat ${input.certificate_id}`);pdf.setCreator("Omnia Global Academy");
 const page=pdf.addPage([841.89,595.28]);const regular=await pdf.embedFont(StandardFonts.Helvetica);const bold=await pdf.embedFont(StandardFonts.HelveticaBold);const primary=pdfColor(input.layout.primary_color||BLUE),accent=pdfColor(input.layout.accent_color||GOLD),grey=pdfColor(GREY);
 page.drawRectangle({x:14,y:14,width:813.89,height:567.28,borderColor:accent,borderWidth:3});page.drawRectangle({x:20,y:20,width:801.89,height:555.28,borderColor:primary,borderWidth:.8});
 const ogaImage=await embedAsset(pdf,input.oga_logo);if(ogaImage&&input.layout.show_oga_logo!==false){const scale=Math.min(70/ogaImage.width,52/ogaImage.height);page.drawImage(ogaImage,{x:52,y:500,width:ogaImage.width*scale,height:ogaImage.height*scale});}
 page.drawText("OMNIA GLOBAL ACADEMY",{x:130,y:535,size:16,font:bold,color:primary});page.drawText(fontText(regular,input.issuer_name),{x:130,y:516,size:10,font:regular,color:grey});
 const creatorImage=await embedAsset(pdf,input.creator_logo);if(creatorImage&&input.layout.show_creator_logo!==false){const scale=Math.min(100/creatorImage.width,52/creatorImage.height);page.drawImage(creatorImage,{x:740-creatorImage.width*scale,y:500,width:creatorImage.width*scale,height:creatorImage.height*scale});}
 const title=input.layout.title||((input.language==='en')?'CERTIFICATE OF COMPLETION':'CERTIFICAT DE RÉUSSITE');drawCentered(page,bold,title,462,700,17,accent);
 drawCentered(page,regular,input.language==='en'?'This certificate is awarded to':'Ce certificat est décerné à',425,650,11,grey);drawCentered(page,bold,input.student_name,378,700,31,primary);
 drawCentered(page,regular,input.completion_text,342,720,12,grey);drawCentered(page,bold,input.course_title,304,730,19,primary);
 page.drawLine({start:{x:120,y:278},end:{x:722,y:278},thickness:.7,color:accent});
 const details=[input.course_level&&`${input.language==='en'?'Level':'Niveau'} : ${input.course_level}`,input.course_category&&`${input.language==='en'?'Category':'Catégorie'} : ${input.course_category}`,input.duration_label&&`${input.language==='en'?'Duration':'Durée'} : ${input.duration_label}`].filter(Boolean);drawCentered(page,regular,details.join("   •   "),252,720,10,grey);
 if(input.layout.show_partner_logos!==false&&input.accreditations.length){let x=85;for(const acc of input.accreditations.slice(0,5)){const img=await embedAsset(pdf,acc.logo);if(img){const scale=Math.min(72/img.width,34/img.height);page.drawImage(img,{x,y:182,width:img.width*scale,height:img.height*scale});}page.drawText(fontText(bold,acc.organization_name).slice(0,28),{x,y:168,size:7,font:bold,color:primary});if(acc.credit_value)page.drawText(fontText(regular,`${acc.credit_value} ${acc.credit_unit||''}`).slice(0,24),{x,y:157,size:6.5,font:regular,color:grey});x+=145;}}
 const creatorSig=await embedAsset(pdf,input.creator_signature);const ogaSig=await embedAsset(pdf,input.oga_signature);const signatureY=80;
 if(input.layout.show_signatures!==false&&creatorSig){const scale=Math.min(105/creatorSig.width,42/creatorSig.height);page.drawImage(creatorSig,{x:105,y:signatureY+18,width:creatorSig.width*scale,height:creatorSig.height*scale});}
 page.drawLine({start:{x:85,y:signatureY+14},end:{x:235,y:signatureY+14},thickness:.7,color:primary});page.drawText(fontText(bold,input.creator_name||input.issuer_name).slice(0,32),{x:95,y:signatureY,size:9,font:bold,color:primary});page.drawText(fontText(regular,input.issuer_type==='structure'?'Responsable de la Structure':input.issuer_type==='professor'?'Formateur':'Émetteur'),{x:105,y:signatureY-12,size:7.5,font:regular,color:grey});
 if(input.layout.show_signatures!==false&&ogaSig){const scale=Math.min(105/ogaSig.width,42/ogaSig.height);page.drawImage(ogaSig,{x:600,y:signatureY+18,width:ogaSig.width*scale,height:ogaSig.height*scale});}
 page.drawLine({start:{x:585,y:signatureY+14},end:{x:735,y:signatureY+14},thickness:.7,color:primary});page.drawText("Omnia Global Academy",{x:606,y:signatureY,size:9,font:bold,color:primary});page.drawText(fontText(regular,input.institution_signature_label||"Direction académique"),{x:612,y:signatureY-12,size:7.5,font:regular,color:grey});
 const qr=await embedAsset(pdf,input.qr_asset);if(qr&&input.layout.show_qr!==false){page.drawImage(qr,{x:382,y:62,width:78,height:78});page.drawText(fontText(regular,input.certificate_id),{x:366,y:48,size:7,font:regular,color:grey});}
 if(input.layout.show_stamps!==false){let stampX=250;for(const acc of input.accreditations.slice(0,3)){const stamp=await embedAsset(pdf,acc.stamp);if(stamp){const scale=Math.min(48/stamp.width,48/stamp.height);page.drawImage(stamp,{x:stampX,y:94,width:stamp.width*scale,height:stamp.height*scale});stampX+=55;}}}
 page.drawText(fontText(regular,`${input.language==='en'?'Issued on':'Délivré le'} ${input.issued_label}`),{x:52,y:36,size:7.5,font:regular,color:grey});page.drawText(fontText(regular,input.verify_url),{x:530,y:36,size:7.5,font:regular,color:grey});
 return new Uint8Array(await pdf.save());
}
function matchBadgeTemplate(template:any,course:any,accreditations:any[]){const meta=template.metadata||{};const courseIds=Array.isArray(meta.course_ids)?meta.course_ids:[];const categories=Array.isArray(meta.categories)?meta.categories:[];const levels=Array.isArray(meta.levels)?meta.levels:[];const certificationTypes=Array.isArray(meta.certification_types)?meta.certification_types:[];if(courseIds.length&&!courseIds.includes(course.id))return false;if(categories.length&&!categories.includes(course.category))return false;if(levels.length&&!levels.includes(course.level))return false;if(certificationTypes.length&&!accreditations.some(a=>certificationTypes.includes(a.certification_type)))return false;return true;}
async function awardAutomaticBadges(sb:any,user:any,course:any,certificate:any,accreditations:any[],appUrl:string){
 const {data:settings}=await sb.from("certificate_settings").select("value").eq("key","certificate_auto_badges_enabled").maybeSingle();if(settings&&String(settings.value)!=='true')return[];
 const {data:templates}=await sb.from("badge_templates").select("*").eq("status","active").eq("automatic_enabled",true);const awards:any[]=[];
 for(const template of (templates||[]).filter((t:any)=>Array.isArray(t.source_types)&&t.source_types.some((s:string)=>['course','course_completion','course_certificate'].includes(s))&&matchBadgeTemplate(t,course,accreditations))){
  const {data:existing}=await sb.from("badge_awards").select("*").eq("template_id",template.id).eq("recipient_user_id",user.id).eq("source_type","course_certificate").eq("source_id",certificate.id).neq("status","revoked").maybeSingle();if(existing){awards.push(existing);continue;}
  const awardId=crypto.randomUUID(),credentialUuid=crypto.randomUUID(),verificationCode=`OGA-${crypto.randomUUID().replace(/-/g,'').slice(0,16).toUpperCase()}`;const issuedAt=new Date().toISOString();const expiresAt=template.validity_days?new Date(Date.now()+Number(template.validity_days)*86400000).toISOString():null;const credentialJson={"@context":["https://www.w3.org/ns/credentials/v2","https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json"],id:`${appUrl}/credentials/${credentialUuid}`,type:["VerifiableCredential","OpenBadgeCredential"],issuer:{id:`${appUrl}/issuers/${template.issuer_id}`},validFrom:issuedAt,credentialSubject:{id:`${appUrl}/learners/${user.id}`,type:["AchievementSubject"],achievement:{id:template.achievement_uri||`${appUrl}/achievements/${template.id}`,type:["Achievement"],name:template.name,description:template.description,criteria:{narrative:template.criteria_narrative},image:template.image_url?{id:template.image_url,type:"Image"}:undefined}},evidence:[{id:certificate.verification_url,type:["Evidence"],name:course.title,description:`Certificat ${certificate.omnia_certificate_id}`}]};
  const {data:award,error}=await sb.from("badge_awards").insert({id:awardId,credential_uuid:credentialUuid,verification_code:verificationCode,template_id:template.id,issuer_id:template.issuer_id,recipient_user_id:user.id,awarded_by:null,source_type:"course_certificate",source_id:certificate.id,status:"awarded",visibility:template.default_visibility||"oga",evidence_summary:`Réussite de la formation ${course.title}`,issued_at:issuedAt,expires_at:expiresAt,recipient_subject_id:user.id,standards_status:"ob3_draft",credential_json:credentialJson}).select("*").single();if(error){console.warn("automatic_badge_failed",template.id,error.message);continue;}
  let {data:record}=await sb.from("clr_records").select("*").eq("user_id",user.id).maybeSingle();if(!record){const created=await sb.from("clr_records").insert({user_id:user.id,title:"Omnia Learning Record",status:"active",default_visibility:"oga",standards_status:"clr2_draft",last_built_at:issuedAt}).select("*").single();record=created.data;}
  if(record){await sb.from("clr_achievements").insert({clr_record_id:record.id,award_id:award.id,source_type:"course_certificate",source_id:certificate.id,title:template.name,description:template.description,achievement_type:template.achievement_type||"Achievement",section:"badges",status:"active",visibility:template.default_visibility||"oga",issued_at:issuedAt,payload:credentialJson});}
  awards.push(award);
 }
 return awards;
}

Deno.serve(async(req:Request)=>{
 if(req.method==="OPTIONS")return new Response(null,{status:200,headers:corsHeaders});
 try{
  const sb=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);const body=await req.json();
  const headerToken=req.headers.get("x-omnia-session-token")||req.headers.get("Authorization")||"";const callerId=await verifySession(sb,headerToken);const internal=body.internal_request===true&&isOmniaInternalRequest(req);if(!callerId&&!internal)return json({error:"UNAUTHORIZED"},401);
  const userId=String(body.user_id||callerId||""),courseId=String(body.course_id||"");if(!userId||!courseId)return json({error:"MISSING_FIELDS"},400);
  if(callerId&&userId!==callerId&&!internal){const {data:role}=await sb.from("user_roles").select("role").eq("user_id",callerId).in("role",["super_admin","admin"]).maybeSingle();if(!role)return json({error:"FORBIDDEN"},403);}
  const {data:assessments}=await sb.from("course_assessments").select("id,title,scope,passing_score").eq("course_id",courseId).eq("required",true).eq("is_active",true);const missing:string[]=[];
  if(!(assessments||[]).length)missing.push("required_assessments_missing");for(const a of assessments||[]){const {data:best}=await sb.from("assessment_attempts").select("score").eq("assessment_id",a.id).eq("user_id",userId).eq("passed",true).eq("result_status","published").order("score",{ascending:false}).limit(1).maybeSingle();if(!best||Number(best.score||0)<Number(a.passing_score||1))missing.push(`${a.scope}:${a.id}`);}
  const {data:attemptIds}=await sb.from("assessment_attempts").select("id").eq("course_id",courseId).eq("user_id",userId);if(attemptIds?.length){const {count}=await sb.from("assessment_answers").select("id",{count:"exact",head:true}).eq("review_status","pending").in("attempt_id",attemptIds.map((x:any)=>x.id));if((count||0)>0)missing.push("manual_reviews_pending");}
  const [{data:course},{data:user},{data:progress},{data:attemptTimes}]=await Promise.all([sb.from("courses").select("*").eq("id",courseId).maybeSingle(),sb.from("users").select("id,full_name,email").eq("id",userId).maybeSingle(),sb.from("user_lesson_progress").select("is_completed,time_spent_seconds").eq("user_id",userId).eq("course_id",courseId),sb.from("assessment_attempts").select("time_spent_seconds").eq("course_id",courseId).eq("user_id",userId)]);if(!course||!user)return json({error:"NOT_FOUND"},404);
  if((progress||[]).some((x:any)=>!x.is_completed))missing.push("lessons_incomplete");const spent=(progress||[]).reduce((n:number,x:any)=>n+Number(x.time_spent_seconds||0),0)+(attemptTimes||[]).reduce((n:number,x:any)=>n+Number(x.time_spent_seconds||0),0);const requiredSeconds=Number(course.calculated_duration_minutes||0)*60;if(requiredSeconds>0&&spent<requiredSeconds)missing.push("minimum_time_not_reached");
  if(missing.length){await sb.from("certificate_generation_audit").insert({user_id:userId,course_id:courseId,result:"blocked",missing_conditions:missing,source:body.source||"automatic"});return json({error:"CONDITIONS_NOT_MET",missing},422);}
  const {data:existing}=await sb.from("certificates").select("id,omnia_certificate_id,pdf_url,pdf_storage_path,cpd_pending,verification_url,pdf_sha256,status,validity_status,expires_at").eq("user_id",userId).eq("course_id",courseId).maybeSingle();if(existing){const revoked=existing.validity_status==="revoked"||["revoque","revoked"].includes(String(existing.status||"").toLowerCase());const expired=Boolean(existing.expires_at&&new Date(existing.expires_at)<new Date());const signedPdf=!revoked&&!expired?await signCertificatePdf(sb,existing.pdf_storage_path,existing.pdf_url,300):null;return json({certificate_id:existing.omnia_certificate_id,pdf_url:signedPdf,verification_url:existing.verification_url,pdf_sha256:existing.pdf_sha256,cpd_pending:existing.cpd_pending,existing:true});}
  const {data:accreditations}=await sb.from("course_certifications").select("*").eq("course_id",courseId).eq("status","validated").eq("display_on_certificate",true).order("created_at");
  const appUrl=Deno.env.get("PUBLIC_APP_URL")||Deno.env.get("APP_URL")||"https://omniaglobalacademy.com",certificateUuid=crypto.randomUUID(),certId=await uniqueCertId(sb),verifyUrl=`${appUrl}/verify/${certId}`,language=String(course.language||"fr").slice(0,2).toLowerCase();
  const {data:settingsRows}=await sb.from("certificate_settings").select("key,value");const settings:Record<string,string>={};for(const row of settingsRows||[])settings[row.key]=row.value;
  let creatorName="",creatorLogo="",creatorSignature="",issuerType="professor",issuerName="Omnia Global Academy";
  if(course.establishment_id){const {data:e}=await sb.from("etablissement_profiles").select("school_name,logo_url,director_name,signature_url").eq("id",course.establishment_id).maybeSingle();if(e){issuerType="structure";issuerName=e.school_name||issuerName;creatorName=e.director_name||issuerName;creatorLogo=e.logo_url||"";creatorSignature=e.signature_url||"";}}
  else if(course.creator_type==="plateforme"){issuerType="platform";issuerName=settings.institution_name||"Omnia Global Academy";creatorName=issuerName;}
  else if(course.creator_id){const [{data:p},{data:pp}]=await Promise.all([sb.from("users").select("full_name,avatar_url").eq("id",course.creator_id).maybeSingle(),sb.from("professeur_profiles").select("signature_url").eq("user_id",course.creator_id).maybeSingle()]);creatorName=p?.full_name||"Formateur";issuerName=creatorName;creatorSignature=pp?.signature_url||"";creatorLogo=p?.avatar_url||"";}
  const template=await resolveTemplate(sb,course,language,issuerType==='professor'?'professeur':issuerType);const layout={style:"classic",primary_color:BLUE,accent_color:GOLD,title:language==='en'?"CERTIFICATE OF COMPLETION":"CERTIFICAT DE RÉUSSITE",show_oga_logo:true,show_creator_logo:true,show_partner_logos:true,show_signatures:true,show_stamps:true,show_qr:true,show_credits:true,...(template?.layout_json||{})};
  const ogaLogo=await snapshotAsset(sb,settings.certificate_logo_url||"/IMG_0349.png",certificateUuid,"oga-logo",appUrl),creatorLogoSnapshot=await snapshotAsset(sb,creatorLogo,certificateUuid,"creator-logo",appUrl),creatorSignatureSnapshot=await snapshotAsset(sb,creatorSignature,certificateUuid,"creator-signature",appUrl),ogaSignature=await snapshotAsset(sb,settings.institution_signature_url,certificateUuid,"oga-signature",appUrl);
  const accSnapshots:AccreditationSnapshot[]=[];for(const [index,a] of (accreditations||[]).entries()){const source=a.immutable_asset_snapshot||{};const logo=await snapshotAsset(sb,source.badge_url||source.logo_url||a.badge_url||a.logo_url,certificateUuid,`partner-${index+1}-logo`,appUrl);const signature=await snapshotAsset(sb,source.signature_url||a.signature_url,certificateUuid,`partner-${index+1}-signature`,appUrl);const stamp=await snapshotAsset(sb,source.stamp_url||a.stamp_url,certificateUuid,`partner-${index+1}-stamp`,appUrl);accSnapshots.push({id:a.id,organization_name:a.organization_name,certification_name:a.certification_name,certification_code:a.certification_code,credit_value:a.credit_value,credit_unit:a.credit_unit,verification_url:a.verification_url,logo,signature,stamp,display_order:index,permission_snapshot:source.permission||source});}
  const qrData=await QRCode.toDataURL(verifyUrl,{width:240,margin:1,color:{dark:BLUE,light:WHITE}});const qrBytes=Uint8Array.from(atob(qrData.split(",")[1]),c=>c.charCodeAt(0));const qrAsset:AssetSnapshot={original_url:verifyUrl,snapshot_url:null,storage_path:null,mime_type:"image/png",sha256:await sha256(qrBytes),bytes:qrBytes};
  const issuedAt=new Date();const issuedLabel=issuedAt.toLocaleDateString(language==='en'?'en-GB':'fr-FR',{day:'2-digit',month:'long',year:'numeric'});const completionText=language==='en'?(settings.certificate_text_en||"for successfully completing the course"):(settings.certificate_text_fr||"pour avoir complété avec succès la formation");const durationMinutes=Number(course.calculated_duration_minutes||0);const durationLabel=durationMinutes>=60?`${Math.floor(durationMinutes/60)} h${durationMinutes%60?` ${durationMinutes%60} min`:''}`:`${durationMinutes} min`;
  const pdfBytes=await buildPdf({certificate_id:certId,student_name:user.full_name,course_title:course.title,course_level:course.level,course_category:course.category,duration_label:durationMinutes?durationLabel:null,completion_text:completionText,issuer_name:issuerName,issuer_type:issuerType,creator_name:creatorName,language,issued_label:issuedLabel,verify_url:verifyUrl,layout,oga_logo:ogaLogo,creator_logo:creatorLogoSnapshot,creator_signature:creatorSignatureSnapshot,oga_signature:ogaSignature,accreditations:accSnapshots,qr_asset:qrAsset,institution_signature_label:settings.institution_signature_label});const pdfHash=await sha256(pdfBytes),pdfPath=`certificates/${userId}/${certId}.pdf`;
  const {error:uploadError}=await sb.storage.from("certificates").upload(pdfPath,pdfBytes,{contentType:"application/pdf",upsert:false});if(uploadError)throw uploadError;const pdfDownloadUrl=await createSignedObjectUrl(sb,"certificates",pdfPath,300);
  const issuerSnapshot={type:issuerType,name:issuerName,creator_name:creatorName,oga_logo:ogaLogo,creator_logo:creatorLogoSnapshot,captured_at:issuedAt.toISOString()};const signatureSnapshot={creator:creatorSignatureSnapshot,omnia:ogaSignature,captured_at:issuedAt.toISOString()};const accreditationSnapshot=accSnapshots.map(({logo,signature,stamp,...rest})=>({...rest,logo,signature,stamp}));
  const {data:cert,error:certError}=await sb.from("certificates").insert({id:certificateUuid,omnia_certificate_id:certId,user_id:userId,course_id:courseId,student_full_name:user.full_name,course_title:course.title,course_level:course.level||"",course_category:course.category||"",cpd_hours:(accreditations||[]).filter((a:any)=>a.certification_type==='cpd').reduce((n:number,a:any)=>n+Number(a.credit_value||0),0),template_type:layout.style||"classic",creator_name:creatorName||null,establishment_name:issuerType==='structure'?issuerName:null,establishment_logo_url:creatorLogoSnapshot?.snapshot_url||null,director_name:issuerType==='structure'?creatorName:null,director_signature_url:creatorSignatureSnapshot?.snapshot_url||null,cpd_accredited:(accreditations||[]).some((a:any)=>a.certification_type==='cpd'),cpd_provider_code:(accreditations||[]).find((a:any)=>a.certification_type==='cpd')?.certification_code||null,pdf_url:null,pdf_storage_path:pdfPath,pdf_mime_type:"application/pdf",pdf_sha256:pdfHash,validity_status:"valid",verification_url:verifyUrl,qr_svg:null,duration_minutes:durationMinutes,course_version:String(course.current_version||"1.0"),issuer_type:issuerType,issuer_name:issuerName,language_code:language,document_type:"completion_certificate",source_type:"course",template_id:template?.id||null,template_version:template?.version||null,issuance_snapshot:{student_full_name:user.full_name,course_title:course.title,course_version:String(course.current_version||"1.0"),issuer:issuerSnapshot,template:{id:template?.id||null,version:template?.version||null,layout},accreditations:accreditationSnapshot,generated_at:issuedAt.toISOString()},issuer_snapshot:issuerSnapshot,accreditation_snapshot:accreditationSnapshot,signature_snapshot:signatureSnapshot,metadata:{assessment_thresholds:Object.fromEntries((assessments||[]).map((a:any)=>[a.id,{title:a.title,scope:a.scope,passing_score:Number(a.passing_score||0)}])),time_spent_seconds:spent}}).select("*").single();if(certError)throw certError;
  if(accSnapshots.length){const rows=accSnapshots.map((a,index)=>({certificate_id:cert.id,course_certification_id:a.id,organization_name:a.organization_name,certification_name:a.certification_name,certification_code:a.certification_code,credit_value:a.credit_value,credit_unit:a.credit_unit,badge_url:a.logo?.snapshot_url||null,logo_url:a.logo?.snapshot_url||null,signature_url:a.signature?.snapshot_url||null,stamp_url:a.stamp?.snapshot_url||null,verification_url:a.verification_url,valid_from:null,expires_at:null,status:"valid",partner_snapshot:{organization_name:a.organization_name,certification_name:a.certification_name,assets:{logo:a.logo,signature:a.signature,stamp:a.stamp},captured_at:issuedAt.toISOString()},logo_permission_snapshot:a.permission_snapshot,display_order:index}));const {error}=await sb.from("certificate_accreditations").insert(rows);if(error)throw error;}
  const awards=await awardAutomaticBadges(sb,user,course,cert,accreditations||[],appUrl);if(awards.length)await sb.from("certificates").update({badge_awards_snapshot:awards.map((a:any)=>({id:a.id,template_id:a.template_id,credential_uuid:a.credential_uuid,verification_code:a.verification_code,issued_at:a.issued_at}))}).eq("id",cert.id);
  const creditSummary=(accreditations||[]).map((a:any)=>({organization:a.organization_name,value:a.credit_value,unit:a.credit_unit}));await sb.from("user_profile_certifications").upsert({user_id:userId,certificate_id:cert.id,course_id:courseId,title:course.title,issuer:issuerName,credential_id:certId,verification_url:verifyUrl,issued_at:cert.issued_at,expires_at:null,hours_or_credits:creditSummary,status:"valid",updated_at:new Date().toISOString()},{onConflict:"user_id,certificate_id"});await sb.from("user_enrollments").update({completed_at:new Date().toISOString()}).eq("user_id",userId).eq("course_id",courseId);await sb.from("certificate_generation_audit").insert({user_id:userId,course_id:courseId,certificate_id:cert.id,result:"generated",source:body.source||"automatic"});try{await sb.rpc("oga_referral_record_event",{p_referred_user_id:userId,p_event_type:"certificate_earned",p_event_key:`certificate:${cert.id}`,p_metadata:{certificate_id:cert.id,course_id:courseId}})}catch{};
  fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/notify-dispatch`,{method:"POST",headers:omniaInternalHeaders(),body:JSON.stringify({type:"certificat_genere",payload:{userId,formation_titre:course.title,certificate_id:certId,verify_url:verifyUrl,pdf_url:verifyUrl}})}).catch(()=>{});
  return json({certificate_id:certId,pdf_url:pdfDownloadUrl,pdf_sha256:pdfHash,verification_url:verifyUrl,accreditations:creditSummary,automatic_badges:awards.length});
 }catch(error){console.error("certificate-generate",error);return json({error:"INTERNAL",message:error instanceof Error?error.message:String(error)},500);}
});
