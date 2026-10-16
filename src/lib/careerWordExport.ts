/**
 * OGA Career Studio V3 — Lot 3A
 * Portable, dependency-free OOXML/DOCX export from the canonical structured model.
 * This is an EDITABLE, clean single-column Word rendition, not a screenshot or
 * a promise of pixel-identical reproduction of creative HTML templates.
 * Word handles pagination (A4/Letter) and keeps paragraphs editable.
 */
import type { CareerDocumentFull } from './careerStudioData';
import { buildCareerDocumentModel, normalizeCareerDesign } from './careerDocumentCore';
import { saveOrShareBlob } from './mobile/files';

type ZipEntry = { name: string; content: string };

function xml(value: string): string {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function textContent(value: string): string {
  const source = String(value || '');
  return source
    .replace(/<\s*br\s*\/?\s*>/gi, '\n')
    .replace(/<\s*\/p\s*>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, ' • ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .trim();
}

function paragraph(text: string, style = 'Normal', keepNext = false): string {
  const normalized = textContent(text);
  if (!normalized) return '';
  return normalized.split(/\r?\n/).filter(line => line.trim()).map(line =>
    `<w:p><w:pPr><w:pStyle w:val="${style}"/>${keepNext ? '<w:keepNext/>' : ''}</w:pPr><w:r><w:t xml:space="preserve">${xml(line.trim())}</w:t></w:r></w:p>`,
  ).join('');
}

function color(value: unknown, fallback: string): string {
  const s = String(value || '');
  return /^#[0-9a-fA-F]{6}$/.test(s) ? s.slice(1).toUpperCase() : fallback;
}

function safeFileName(value: string): string {
  return (value || 'document-career').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_ -]/g, '').trim().replace(/\s+/g, '-').slice(0, 75) || 'document-career';
}

function documentXml(document: CareerDocumentFull): string {
  const model = buildCareerDocumentModel(document.doc_type, document.doc_data);
  const design = normalizeCareerDesign(document.doc_type, document.design_options);
  const isLetter = design.page_format === 'letter';
  const landscape = design.orientation === 'landscape';
  const width = isLetter ? 12240 : 11906;
  const height = isLetter ? 15840 : 16838;
  const pgSize = landscape ? `<w:pgSz w:w="${height}" w:h="${width}" w:orient="landscape"/>` : `<w:pgSz w:w="${width}" w:h="${height}"/>`;
  const primary = color(design.colors?.primary, '002050');
  const accent = color(design.colors?.accent, 'BF8813');
  const style = `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
    <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="21"/><w:color w:val="374151"/></w:rPr><w:pPr><w:spacing w:after="90" w:line="270" w:lineRule="auto"/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="Name"><w:name w:val="Name"/><w:rPr><w:b/><w:sz w:val="36"/><w:color w:val="${primary}"/></w:rPr><w:pPr><w:spacing w:after="100"/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:sz w:val="23"/><w:color w:val="${accent}"/></w:rPr><w:pPr><w:spacing w:after="100"/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="${primary}"/><w:sz w:val="24"/></w:rPr><w:pPr><w:keepNext/><w:spacing w:before="230" w:after="100"/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:rPr><w:b/><w:color w:val="${primary}"/><w:sz w:val="21"/></w:rPr><w:pPr><w:keepNext/><w:spacing w:before="120" w:after="40"/></w:pPr></w:style>
    <w:style w:type="paragraph" w:styleId="Small"><w:name w:val="Small"/><w:basedOn w:val="Normal"/><w:rPr><w:sz w:val="18"/><w:color w:val="64748B"/></w:rPr><w:pPr><w:spacing w:after="80"/></w:pPr></w:style>
  </w:styles>`;
  let body = '';
  for (const section of model.sections) {
    if (!section.visible || !section.entries.length) continue;
    if (section.id === 'profile' || section.id === 'sender') {
      for (const item of section.entries) {
        body += paragraph(item.title, 'Name', true);
        if (item.subtitle) body += paragraph(item.subtitle, 'Subtitle');
        if (item.details?.length) body += paragraph(item.details.join(' · '), 'Small');
      }
      continue;
    }
    if (document.doc_type === 'lm' && section.id === 'letter') {
      for (const item of section.entries) body += paragraph(item.title);
      continue;
    }
    if (document.doc_type === 'lm' && section.id === 'recipient') {
      for (const item of section.entries) {
        body += paragraph(item.title, 'Heading2', true);
        if (item.subtitle) body += paragraph(item.subtitle);
        if (item.details?.length) body += paragraph(item.details.join(' · '), 'Small');
      }
      continue;
    }
    body += paragraph(section.label, 'Heading1', true);
    for (const item of section.entries) {
      if (item.title) body += paragraph(item.title, section.kind === 'list' ? 'Heading2' : 'Normal', section.kind === 'list');
      if (item.subtitle) body += paragraph(item.subtitle, 'Small');
      if (item.details?.length) body += paragraph(item.details.join(' · '), 'Small');
      if (item.body) body += paragraph(item.body);
    }
  }
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr>${pgSize}<w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
  return JSON.stringify({ doc, style });
}

// Small STORED ZIP encoder: valid OPC container without external runtime packages.
// Metadata sizes/CRC are checked in tests against Python's standard zipfile.
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
    const name = encoder.encode(entry.name), content = encoder.encode(entry.content);
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
  const { doc, style } = JSON.parse(documentXml(document)) as { doc: string; style: string };
  const entries: ZipEntry[] = [
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: 'word/_rels/document.xml.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'word/document.xml', content: doc },
    { name: 'word/styles.xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' + style },
  ];
  return packDocx(entries);
}

export async function exportCareerWord(document: CareerDocumentFull): Promise<void> {
  const data = createCareerWordBytes(document);
  await saveOrShareBlob(new Blob([data as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }), {
    fileName: `${safeFileName(document.title)}.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    title: document.title || 'Document Omnia Career',
    text: 'Document Word modifiable créé par Omnia Global Academy',
  });
}
