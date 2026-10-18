/**
 * OGA Career Studio V3 — LOT 3 visual-parity Word export.
 * Produces editable WordprocessingML, reflecting the selected CV/LM layout,
 * colors, headers, dividers, columns and paragraph spacing. The HTML renderer
 * and Word have different layout engines, so exact pixel parity is not promised.
 * No external OOXML runtime package is required.
 */
import type { CareerDocumentFull } from './careerStudioData';
import { buildCareerDocumentModel, normalizeCareerContent, normalizeCareerDesign, type CareerContentSection } from './careerDocumentCore';
import { reactiveResumeProfile, legacyOgaProfile } from './reactiveResumeCatalog';
import { saveOrShareBlob } from './mobile/files';
import type { DocData } from '../components/career/CvTemplates';
import type { LmData } from '../components/career/LmTemplates';

type ZipEntry = { name: string; content: string | Uint8Array };
type PStyle = { style?: string; size?: number; color?: string; bold?: boolean; align?: 'left' | 'right' | 'center'; before?: number; after?: number; line?: number; keepNext?: boolean; border?: string; indent?: number; italic?: boolean };

function xml(value: unknown): string {
  return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
function plain(value: unknown): string {
  return String(value ?? '').replace(/<\s*br\s*\/?\s*>/gi, '\n').replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, ' • ').replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").trim();
}
function color(value: unknown, fallback: string): string {
  const s = String(value || '');
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.slice(1).toUpperCase() : fallback;
}
function safeFileName(value: string): string {
  return (value || 'document-career').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_ -]/g, '').trim().replace(/\s+/g, '-').slice(0, 75) || 'document-career';
}

function para(value: unknown, config: PStyle = {}): string {
  const text = plain(value);
  if (!text) return '';
  const pPr = [
    config.style ? `<w:pStyle w:val="${xml(config.style)}"/>` : '',
    config.align ? `<w:jc w:val="${config.align}"/>` : '',
    config.keepNext ? '<w:keepNext/>' : '',
    `<w:spacing w:before="${config.before ?? 0}" w:after="${config.after ?? 105}" w:line="${config.line ?? 280}" w:lineRule="auto"/>`,
    config.indent ? `<w:ind w:left="${config.indent}"/>` : '',
    config.border ? `<w:pBdr><w:bottom w:val="single" w:sz="10" w:color="${config.border}" w:space="8"/></w:pBdr>` : '',
  ].join('');
  const rPr = [config.bold ? '<w:b/>' : '', config.italic ? '<w:i/>' : '',
    config.color ? `<w:color w:val="${config.color}"/>` : '',
    config.size ? `<w:sz w:val="${config.size}"/>` : '',
  ].join('');
  return `<w:p><w:pPr>${pPr}</w:pPr><w:r><w:rPr>${rPr}</w:rPr>${text.split(/\r?\n/).map(part => `<w:t xml:space="preserve">${xml(part)}</w:t>`).join('<w:br/>')}</w:r></w:p>`;
}
function cell(content: string, width: number, fill?: string, vertical: 'top' | 'center' = 'top'): string {
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/><w:vAlign w:val="${vertical}"/>${fill ? `<w:shd w:fill="${fill}" w:val="clear"/>` : ''}<w:tcMar><w:top w:w="195" w:type="dxa"/><w:left w:w="210" w:type="dxa"/><w:bottom w:w="195" w:type="dxa"/><w:right w:w="210" w:type="dxa"/></w:tcMar></w:tcPr>${content || '<w:p/>'}</w:tc>`;
}
function table(widths: number[], rows: string[][], fills: Array<string | undefined> = []): string {
  const cols = widths.map(w => `<w:gridCol w:w="${w}"/>`).join('');
  const body = rows.map(row => `<w:tr>${row.map((content, i) => cell(content, widths[i], fills[i])).join('')}</w:tr>`).join('');
  return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/><w:tblBorders><w:top w:val="nil"/><w:left w:val="nil"/><w:bottom w:val="nil"/><w:right w:val="nil"/><w:insideH w:val="nil"/><w:insideV w:val="nil"/></w:tblBorders></w:tblPr><w:tblGrid>${cols}</w:tblGrid>${body}</w:tbl>`;
}
type WordPhoto = { bytes: Uint8Array; extension: 'png' | 'jpeg' };
function photoAttachment(document: CareerDocumentFull): WordPhoto | null {
  if (document.doc_type !== 'cv' || !(document.design_options as {photo_enabled?:boolean}).photo_enabled) return null;
  const url=String((document.doc_data as DocData).photo_url || '');
  const match=/^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=\s]+)$/.exec(url);
  if(!match || match[2].length>12_000_000) return null;
  try {
    const binary=atob(match[2].replace(/\s/g,''));
    const bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    return {bytes,extension:match[1]==='png'?'png':'jpeg'};
  } catch { return null; }
}
function photoParagraph(round:boolean):string{
  const geometry=round?'ellipse':'rect';
  // Word editable document with an embedded inline image (not an external link).
  return `<w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="1016000" cy="1016000"/><wp:docPr id="1" name="Photo du CV" descr="Photographie facultative du candidat"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="1" name="Portrait"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId2"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1016000" cy="1016000"/></a:xfrm><a:prstGeom prst="${geometry}"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

function sectionWord(section: CareerContentSection, primary: string, accent: string): string {
  if (!section.visible || !section.entries.length) return '';
  let result = para(section.label.toUpperCase(), { bold: true, color: primary, size: 21, before: 160, after: 120, keepNext: true, border: accent });
  for (const entry of section.entries) {
    result += para(entry.title, { size: 20, bold: section.kind === 'list', color: primary, after: 38, keepNext: !!(entry.subtitle || entry.body) });
    if (entry.subtitle) result += para(entry.subtitle, { size: 17, color: '64748B', after: 45, keepNext: !!entry.body });
    if (entry.details?.length) result += para(entry.details.join(' · '), { size: 17, after: 65 });
    if (entry.body) result += para(entry.body, { size: 19, color: '374151', after: 120 });
  }
  return result;
}
function buildLetter(lm: LmData, visible: (id: string) => boolean, primary: string, accent: string, pageWidth: number, profilePlacement?: string): string {
  const sender = lm.sender || { name: '', address: '', phone: '', email: '', city: '', date: '' };
  const recipient = lm.recipient || { name: '', company: '', address: '' };
void recipient;
  const senderDetails = [sender.email, sender.phone, sender.address].filter(Boolean).join(' · ');
  const header = para(sender.name, { size: 55, color: primary, bold: true, after: 60, keepNext: true })
    + para(senderDetails, { size: 18, color: '64748B', after: 120, border: accent });
  const senderPanel = para(sender.name, { size: 44, color: 'FFFFFF', bold: true, after: 160, keepNext: true })
    + para(senderDetails, { size: 18, color: 'FFFFFF', after: 90 });
  let body = '';
  if (profilePlacement === 'sidebar-only') {
    const wSide = Math.floor(pageWidth * .265);
    const inside = buildLetterContent(lm, visible, primary, accent, pageWidth - wSide);
    body += table([wSide, pageWidth - wSide], [[senderPanel, inside]], [primary, undefined]);
  } else {
    body += header;
    body += buildLetterContent(lm, visible, primary, accent, pageWidth);
  }
  return body;
}
function buildLetterContent(lm: LmData, visible: (id: string) => boolean, primary: string, accent: string, contentWidth: number): string {
  let body = '';
  if (visible('recipient')) {
    const left = para(lm.recipient?.name, { size: 19, bold: true, color: primary, after: 40 })
      + para(lm.recipient?.company, { size: 18, after: 28 })
      + para(lm.recipient?.address, { size: 18, after: 20 });
    const right = para(`${lm.sender?.city || ''}${lm.sender?.date ? ', le ' + lm.sender.date : ''}`, { size: 17, color: '64748B', align: 'right' });
    const leftWidth = Math.floor(contentWidth * .64);
    body += table([leftWidth, contentWidth - leftWidth], [[left, right]]);
  }
  if (visible('subject')) body += para(`Objet : ${lm.subject || ''}`, { bold: true, size: 22, color: primary, border: accent, before: 225, after: 260, keepNext: true });
  if (visible('letter')) {
    body += para(lm.salutation, { size: 21, after: 230, line: 345 });
    for (const part of [lm.intro, lm.motivation, lm.skills_paragraph, lm.company_link, lm.availability, lm.closing]) {
      body += para(part, { size: 20, color: '374151', after: 210, line: 340 });
    }
    body += para(lm.signature || lm.sender?.name, { size: 23, color: primary, bold: true, align: 'right', before: 195, after: 80 });
  }
  return body;
}
function buildCv(doc: CareerDocumentFull, primary: string, accent: string, sidebar: string, pageWidth: number, twoColumn: boolean, sidebarSide?: string | null, headerPlacement?: string, withPhoto=false): string {
  const model = buildCareerDocumentModel('cv', doc.doc_data);
  const data = normalizeCareerContent('cv', doc.doc_data) as DocData;
  const lookup = (id: string) => model.sections.find(section => section.id === id);
  const renderSections = (ids: string[]) => ids.map(id => lookup(id)).filter((section): section is CareerContentSection => !!section)
    .map(section => sectionWord(section, primary, accent)).join('');
  const name = para(data.name, { size: 58, color: primary, bold: true, after: 75, keepNext: true });
  const profession = para(data.title, { size: 25, color: accent, bold: true, after: 105 });
  const details = para([data.contact?.email, data.contact?.phone, data.contact?.location, data.contact?.linkedin, data.contact?.portfolio].filter(Boolean).join(' · '), { size: 17, color: '64748B', after: 165, border: accent });
  const header = withPhoto ? table([pageWidth - 1680, 1680], [[name + profession + details, photoParagraph((doc.design_options as {photo_shape?:string}).photo_shape !== 'square')]]) : name + profession + details;
  const baseIds = model.sections.filter(s => !['profile', 'skills', 'languages', 'interests', 'references'].includes(s.id)).map(s => s.id);
  if (!twoColumn) return header + renderSections(model.sections.filter(s => s.id !== 'profile').map(s => s.id));
  const secondary = renderSections(['skills', 'languages', 'interests', 'references']);
  const main = renderSections(baseIds);
  const sideWidth = Math.floor(pageWidth * .29), mainWidth = pageWidth - sideWidth;
  const sidebarHeader = para(data.name, { color: 'FFFFFF', size: 33, bold: true, after: 100 })
    + para(data.title, { color: 'FFFFFF', size: 20, after: 135 })
    + para([data.contact?.email, data.contact?.phone, data.contact?.location].filter(Boolean).join(' · '), { color: 'FFFFFF', size: 16, after: 160 });
  const sideDark = headerPlacement === 'sidebar-only';
  const side = (sideDark ? (withPhoto ? photoParagraph((doc.design_options as {photo_shape?:string}).photo_shape !== 'square') : '') + sidebarHeader : '') + secondary;
  const fullHeader = headerPlacement === 'full-width' || !headerPlacement;
  const mainWithHeader = fullHeader || sideDark ? main : header + main;
  const widths = sidebarSide === 'right' ? [mainWidth, sideWidth] : [sideWidth, mainWidth];
  const fills = sidebarSide === 'right' ? [undefined, sideDark ? primary : sidebar] : [sideDark ? primary : sidebar, undefined];
  const contents = sidebarSide === 'right' ? [mainWithHeader, side] : [side, mainWithHeader];
  return (fullHeader ? header : '') + table(widths, [contents], fills);
}

function documentXml(document: CareerDocumentFull): { doc: string; style: string; photo: WordPhoto | null } {
  const design = normalizeCareerDesign(document.doc_type, document.design_options);
  const profile = reactiveResumeProfile(document.template_key) || legacyOgaProfile(document.template_key);
  const primary = color(design.colors?.primary, color(profile?.primary, '002050'));
  const accent = color(design.colors?.accent, color(profile?.accent, 'BF8813'));
  const sidebar = color(design.colors?.sidebar, color(profile?.sidebar, 'F8F9FA'));
  const isLetter = design.page_format === 'letter';
  const landscape = design.orientation === 'landscape';
  const width = isLetter ? 12240 : 11906, height = isLetter ? 15840 : 16838;
  const pgSize = landscape ? `<w:pgSz w:w="${height}" w:h="${width}" w:orient="landscape"/>` : `<w:pgSz w:w="${width}" w:h="${height}"/>`;
  const usable = (landscape ? height : width) - 1820;
  const photo = photoAttachment(document);
  const content = document.doc_type === 'lm'
    ? (() => {
      const model = buildCareerDocumentModel('lm', document.doc_data);
      const visible = (id: string) => model.sections.find(s => s.id === id)?.visible !== false;
      const lm = normalizeCareerContent('lm', document.doc_data);
      return buildLetter(lm, visible, primary, accent, usable, profile?.headerPlacement);
    })()
    : buildCv(document, primary, accent, sidebar, usable, profile?.columns === 2, profile?.sidebarSide, profile?.headerPlacement, Boolean(photo));
  const styles = `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="20"/><w:color w:val="374151"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="105" w:line="280" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${content}<w:sectPr>${pgSize}<w:pgMar w:top="900" w:right="910" w:bottom="900" w:left="910" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return { doc, style: styles, photo };
}

// Small STORED ZIP encoder: valid OPC container without external runtime packages.
function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function packDocx(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  const put16 = (view: DataView, at: number, value: number) => view.setUint16(at, value, true);
  const put32 = (view: DataView, at: number, value: number) => view.setUint32(at, value, true);
  for (const entry of entries) {
    const name = encoder.encode(entry.name), content = typeof entry.content === 'string' ? encoder.encode(entry.content) : entry.content;
    const checksum = crc32(content);
    const header = new Uint8Array(30 + name.length);
    const local = new DataView(header.buffer);
    put32(local, 0, 0x04034b50); put16(local, 4, 20); put16(local, 6, 0); put16(local, 8, 0);
    put32(local, 14, checksum); put32(local, 18, content.length); put32(local, 22, content.length);
    put16(local, 26, name.length); header.set(name, 30);
    chunks.push(header, content);
    const directory = new Uint8Array(46 + name.length), dir = new DataView(directory.buffer);
    put32(dir, 0, 0x02014b50); put16(dir, 4, 20); put16(dir, 6, 20);
    put32(dir, 16, checksum); put32(dir, 20, content.length); put32(dir, 24, content.length);
    put16(dir, 28, name.length); put32(dir, 42, offset); directory.set(name, 46);
    central.push(directory); offset += header.length + content.length;
  }
  const centralSize = central.reduce((sum, chunk) => sum + chunk.length, 0);
  const end = new Uint8Array(22), endView = new DataView(end.buffer);
  put32(endView, 0, 0x06054b50); put16(endView, 8, entries.length); put16(endView, 10, entries.length);
  put32(endView, 12, centralSize); put32(endView, 16, offset);
  const output = new Uint8Array(offset + centralSize + end.length);
  let position = 0;
  for (const chunk of [...chunks, ...central, end]) { output.set(chunk, position); position += chunk.length; }
  return output;
}

export function createCareerWordBytes(document: CareerDocumentFull): Uint8Array {
  const { doc, style, photo } = documentXml(document);
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/_rels/document.xml.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'word/document.xml', content: doc },
    { name: 'word/styles.xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + style },
  ];
  if (photo) {
    entries.push({ name: `word/media/portrait.${photo.extension}`, content: photo.bytes });
    entries[0].content = String(entries[0].content).replace('</Types>', `<Default Extension="${photo.extension}" ContentType="image/${photo.extension}"/></Types>`);
    entries[2].content = String(entries[2].content).replace('</Relationships>', `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/portrait.${photo.extension}"/></Relationships>`);
  }
  return packDocx(entries);
}

/** Convert an uploaded WebP/remote photo into OOXML-friendly PNG when possible. */
async function prepareWordPhoto(document: CareerDocumentFull): Promise<CareerDocumentFull> {
  if (document.doc_type !== 'cv' || !(document.design_options as {photo_enabled?:boolean}).photo_enabled) return document;
  const data=document.doc_data as DocData;
  const source=String(data.photo_url || '');
  if (!source || /^data:image\/(png|jpe?g);base64,/.test(source)) return document;
  try {
    const image=new Image();
    image.crossOrigin='anonymous';
    await new Promise<void>((resolve,reject)=>{
      image.onload=()=>resolve(); image.onerror=()=>reject(Error('Photo inaccessible'));
      image.src=source;
      if (image.complete) {
        if (image.naturalWidth) resolve(); else reject(Error('Photo invalide'));
      }
    });
    const canvas=globalThis.document.createElement('canvas');
    const ratio=Math.min(1, 600/Math.max(image.naturalWidth,image.naturalHeight));
    canvas.width=Math.max(1,Math.floor(image.naturalWidth*ratio));
    canvas.height=Math.max(1,Math.floor(image.naturalHeight*ratio));
    const context=canvas.getContext('2d');
    if(!context) return document;
    context.drawImage(image,0,0,canvas.width,canvas.height);
    return {...document,doc_data:{...data,photo_url:canvas.toDataURL('image/png')}};
  } catch { return document; }
}

export async function exportCareerWord(document: CareerDocumentFull): Promise<void> {
  const data = createCareerWordBytes(await prepareWordPhoto(document));
  await saveOrShareBlob(new Blob([data as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), {
    fileName: `${safeFileName(document.title)}.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    title: document.title || 'Document Omnia Career',
    text: 'Document Word modifiable créé par Omnia Global Academy',
  });
}
