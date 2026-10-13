import { inflateRawSync } from "node:zlib";
import { createHash } from "node:crypto";

const MAX_UPLOAD = 2 * 1024 * 1024;
const MAX_XML = 8 * 1024 * 1024;
const WANTED = new Set(["word/document.xml", "word/_rels/document.xml.rels"]);

function decode(value) {
  return value.replace(/&(?:amp|lt|gt|quot|apos);|&#(?:x[\da-f]+|\d+);/gi, entity => {
    const names = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
    if (names[entity]) return names[entity];
    const number = entity.startsWith("&#x") ? Number.parseInt(entity.slice(3,-1),16) : Number(entity.slice(2,-1));
    return number > 0 && number <= 0x10ffff && !(number >= 0xd800 && number <= 0xdfff) ? String.fromCodePoint(number) : "";
  });
}

// Read only the two bounded OOXML parts from the central directory. Never
// extract paths, resolve external relationships, execute macros or fetch URLs.
export function readHomeworkDocx(bytes) {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_UPLOAD) throw new Error("Choose a DOCX smaller than 2 MB");
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50) { end = i; break; }
  }
  if (end < 0 || bytes.readUInt16LE(end+4) || bytes.readUInt16LE(end+6)) throw new Error("This file is not a supported DOCX");
  const count = bytes.readUInt16LE(end+10), size = bytes.readUInt32LE(end+12), offset = bytes.readUInt32LE(end+16);
  if (count > 1000 || offset + size > end) throw new Error("The DOCX package is too large or invalid");
  const parts = {}; let cursor = offset;
  for (let i = 0; i < count; i++) {
    if (cursor+46 > end || bytes.readUInt32LE(cursor) !== 0x02014b50) throw new Error("The DOCX package is invalid");
    const flags = bytes.readUInt16LE(cursor+8), method = bytes.readUInt16LE(cursor+10);
    const compressed = bytes.readUInt32LE(cursor+20), expanded = bytes.readUInt32LE(cursor+24);
    const nameLength = bytes.readUInt16LE(cursor+28), extra = bytes.readUInt16LE(cursor+30), comment = bytes.readUInt16LE(cursor+32);
    const local = bytes.readUInt32LE(cursor+42);
    const name = bytes.subarray(cursor+46,cursor+46+nameLength).toString("utf8");
    cursor += 46+nameLength+extra+comment;
    if (cursor > offset+size) throw new Error("The DOCX package is invalid");
    if (!WANTED.has(name)) continue;
    if (parts[name] || flags & 1 || ![0,8].includes(method) || expanded > MAX_XML || local+30 > offset || bytes.readUInt32LE(local) !== 0x04034b50) throw new Error("The DOCX contains an unsupported document part");
    const begin = local+30+bytes.readUInt16LE(local+26)+bytes.readUInt16LE(local+28);
    if (begin+compressed > offset) throw new Error("The DOCX package is invalid");
    const data = bytes.subarray(begin,begin+compressed);
    const xml = method === 8 ? inflateRawSync(data,{maxOutputLength:MAX_XML}) : data;
    if (xml.length !== expanded || xml.length > MAX_XML) throw new Error("The DOCX document part is invalid");
    parts[name] = xml.toString("utf8");
  }
  if (!parts["word/document.xml"]) throw new Error("The DOCX has no readable document text");
  return parts;
}

export function extractHomework({filename, content_base64}) {
  if (typeof filename !== "string" || !/\.docx$/i.test(filename) || filename.length > 160 || typeof content_base64 !== "string" || content_base64.length > MAX_UPLOAD*1.4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(content_base64)) throw new Error("Choose a Word DOCX file smaller than 2 MB");
  const bytes = Buffer.from(content_base64,"base64");
  const parts = readHomeworkDocx(bytes);
  const xml = parts["word/document.xml"];
  const paragraphs = [...xml.matchAll(/<w:p(?:\s[^>]*)?>[\s\S]*?<\/w:p>/g)].map(match => [...match[0].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(t=>decode(t[1])).join("").trim()).filter(Boolean);
  if (paragraphs.join("\n").length > 30000) throw new Error("The sheet contains too much text to review here");
  const relationships = new Map();
  for (const match of (parts["word/_rels/document.xml.rels"] || "").matchAll(/<Relationship\b([^>]*)\/?\s*>/g)) {
    const attrs = Object.fromEntries([...match[1].matchAll(/([\w:]+)="([^"]*)"/g)].map(m=>[m[1],decode(m[2])]));
    if (!attrs.Type?.endsWith("/hyperlink")) continue;
    try { const url = new URL(attrs.Target); if (url.protocol === "https:" && !url.username && !url.password) relationships.set(attrs.Id,url.href); } catch {}
  }
  const links = [...xml.matchAll(/<w:hyperlink\b[^>]*r:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>/g)].map(match=>({url:relationships.get(match[1]),label:[...match[2].matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map(t=>decode(t[1])).join("") || "School document"})).filter(link=>link.url);
  return {filename:filename.split(/[\\/]/).at(-1),source_hash:createHash("sha256").update(bytes).digest("hex"),paragraphs,links:links.slice(0,12),
    notice:"Review the extracted text, choose the work to publish and enter its due date. Linked documents and spelling words have not been fetched."};
}
