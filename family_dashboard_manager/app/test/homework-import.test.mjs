import test from "node:test";
import assert from "node:assert/strict";
import { extractHomework } from "../src/homework-import.mjs";

function zip(parts) {
  const local=[], central=[];let offset=0;
  for(const [name,body] of Object.entries(parts)) {
    const key=Buffer.from(name),bytes=Buffer.from(body),l=Buffer.alloc(30),c=Buffer.alloc(46);
    l.writeUInt32LE(0x04034b50);l.writeUInt32LE(bytes.length,18);l.writeUInt32LE(bytes.length,22);l.writeUInt16LE(key.length,26);
    c.writeUInt32LE(0x02014b50);c.writeUInt32LE(bytes.length,20);c.writeUInt32LE(bytes.length,24);c.writeUInt16LE(key.length,28);c.writeUInt32LE(offset,42);
    local.push(l,key,bytes);central.push(c,key);offset+=30+key.length+bytes.length;
  }
  const end=Buffer.alloc(22),directory=Buffer.concat(central);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(Object.keys(parts).length,8);end.writeUInt16LE(Object.keys(parts).length,10);end.writeUInt32LE(directory.length,12);end.writeUInt32LE(offset,16);
  return Buffer.concat([...local,directory,end]);
}

test("extracts school text and only HTTPS hyperlinks without fetching linked documents",()=>{
  const bytes=zip({"word/document.xml":'<w:document><w:p><w:r><w:t>Science &amp; reading</w:t></w:r></w:p><w:p><w:hyperlink r:id="rId1"><w:r><w:t>Worksheet</w:t></w:r></w:hyperlink></w:p></w:document>',"word/_rels/document.xml.rels":'<Relationships><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink" Target="https://example.com/sheet" TargetMode="External"/></Relationships>'});
  const result=extractHomework({filename:"Homework.docx",content_base64:bytes.toString("base64")});
  assert.deepEqual(result.paragraphs,["Science & reading","Worksheet"]);
  assert.deepEqual(result.links,[{label:"Worksheet",url:"https://example.com/sheet"}]);
  assert.match(result.notice,/have not been fetched/);
});

test("rejects invalid packages, excessive decompression and wrong file types",()=>{
  assert.throws(()=>extractHomework({filename:"fake.docx",content_base64:Buffer.from("not a zip").toString("base64")}));
  const bytes=zip({"word/document.xml":"text"});bytes.writeUInt32LE(12*1024*1024,bytes.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]))+24);
  assert.throws(()=>extractHomework({filename:"large.docx",content_base64:bytes.toString("base64")}),/unsupported/);
  assert.throws(()=>extractHomework({filename:"macro.docm",content_base64:"AAAA"}),/DOCX/);
});
