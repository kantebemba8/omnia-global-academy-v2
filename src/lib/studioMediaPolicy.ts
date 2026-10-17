/** Studio V4 B2: validated media choices. Server-side checks remain authoritative. */
export type StudioMediaKind = 'image'|'video'|'audio'|'pdf'|'word'|'excel'|'scorm'|'download';
export const STUDIO_MEDIA_POLICY: Record<StudioMediaKind,{extensions:readonly string[];maxBytes:number|null;bucket:string}> = {
  image: {extensions:['jpg','jpeg','png','gif','webp'],maxBytes:20*1024*1024,bucket:'course-images'},
  video: {extensions:['mp4','mov','avi','mkv','webm'],maxBytes:null,bucket:'course-videos'},
  audio: {extensions:['mp3','wav','ogg','m4a'],maxBytes:50*1024*1024,bucket:'course-audios'},
  pdf: {extensions:['pdf'],maxBytes:25*1024*1024,bucket:'course-documents'},
  word: {extensions:['doc','docx'],maxBytes:25*1024*1024,bucket:'course-documents'},
  excel: {extensions:['xls','xlsx','csv'],maxBytes:25*1024*1024,bucket:'course-excel'},
  scorm: {extensions:['zip'],maxBytes:50*1024*1024,bucket:'course-scorm'},
  download: {extensions:['pdf','doc','docx','xls','xlsx','csv','ppt','pptx','txt','md','zip','png','jpg','jpeg','webp','gif','mp3','wav','ogg','m4a','mp4','webm'],maxBytes:50*1024*1024,bucket:'course-resources'},
};
export function checkStudioMediaFile(file: Pick<File,'name'|'size'>, kind: StudioMediaKind): void {
  const policy = STUDIO_MEDIA_POLICY[kind];
  if (!policy) throw new Error('Type de bloc multimédia non pris en charge.');
  if (file.size <= 0) throw new Error('Ce fichier est vide.');
  const extension = file.name.split('.').pop()?.toLowerCase() || '';
  if (!policy.extensions.includes(extension)) throw new Error(`Format .${extension || '?'} incompatible avec le bloc ${kind}.`);
  if (policy.maxBytes !== null && file.size > policy.maxBytes) throw new Error(`Fichier trop volumineux pour ce bloc (maximum ${Math.round(policy.maxBytes / 1048576)} Mo).`);
}
