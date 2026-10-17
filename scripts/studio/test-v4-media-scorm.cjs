'use strict';
/** Automated browser-transport contract tests, without a live account or secrets.
 * They do not prove actual Supabase/Cloudflare/SCORM integration. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '../..');
function exported(rel, additionalGlobals={}) {
  const source=fs.readFileSync(path.join(root,rel),'utf8');
  const {outputText,diagnostics}=ts.transpileModule(source,{fileName:rel,reportDiagnostics:true,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}});
  assert.equal(diagnostics.filter(x=>x.category===ts.DiagnosticCategory.Error).length,0,rel+' parse error');
  const sandbox={exports:{},URL,DOMException,AbortController,Blob,FormData,console,...additionalGlobals};
  vm.runInNewContext(outputText,sandbox,{filename:rel});return sandbox.exports;
}
class MockXHR {
  static behavior='success';
  static last=null;
  constructor(){MockXHR.last=this;this.upload={};this.status=201;this.headers={};}
  open(method,url){this.method=method;this.url=url;}
  setRequestHeader(key,value){this.headers[key]=value;}
  send(body){this.body=body;
    if(MockXHR.behavior==='pending')return;
    if(MockXHR.behavior==='network')this.onerror();
    else {this.upload.onprogress?.({lengthComputable:true,loaded:64,total:128});
      if(MockXHR.behavior==='http-error')this.status=403;
      this.onload();}
  }
  abort(){this.onabort?.();}
}
async function main(){
  const {uploadSignedResource,transferCancelled}=exported('src/lib/studioTransfer.ts',{XMLHttpRequest:MockXHR});
  const file=new Blob(['media-file']);let pct=0;
  MockXHR.behavior='success';
  await uploadSignedResource('https://upload.example.test/object?token=secret','PUT',file,{contentType:'application/pdf',onProgress:(done,total)=>pct=done/total});
  assert.equal(pct,0.5,'actual byte progress');
  assert.equal(MockXHR.last.method,'PUT');
  assert.equal(MockXHR.last.headers['Content-Type'],'application/pdf');
  MockXHR.behavior='http-error';
  await assert.rejects(uploadSignedResource('https://upload.example.test/object','PUT',file),/403/);
  MockXHR.behavior='network';
  await assert.rejects(uploadSignedResource('https://upload.example.test/object','PUT',file),/réseau/);
  assert.throws(()=>uploadSignedResource('http://upload.example.test/object','PUT',file),/HTTPS/);
  MockXHR.behavior='pending';const controller=new AbortController();
  const pending=uploadSignedResource('https://upload.example.test/object','PUT',file,{signal:controller.signal});
  controller.abort();
  await assert.rejects(pending,e=>transferCancelled(e),'abort support');
  const before=new AbortController();before.abort();
  await assert.rejects(uploadSignedResource('https://upload.example.test/object','PUT',file,{signal:before.signal}),e=>transferCancelled(e));
  MockXHR.behavior='success';
  await uploadSignedResource('https://video.cloudflare.test/upload','POST',new FormData());
  assert.equal(MockXHR.last.headers['Content-Type'],undefined,'browser sets form-data boundary');
  const {isTrustedScormMessage}=exported('src/lib/studioScormSecurity.ts');
  const source={};const host='https://app.omnia.test';
  const launch='https://functions.supabase.test/lesson-content/scorm/token/index.html';
  const event={source,origin:'https://functions.supabase.test'};
  assert.equal(isTrustedScormMessage(event,source,launch,host),true);
  assert.equal(isTrustedScormMessage({...event,source:{}},source,launch,host),false);
  assert.equal(isTrustedScormMessage({...event,origin:'https://evil.test'},source,launch,host),false);
  assert.equal(isTrustedScormMessage({...event,origin:'null'},source,launch,host),false);
  assert.equal(isTrustedScormMessage(event,null,launch,host),false);
  assert.equal(isTrustedScormMessage({source,origin:host},source,'/lesson/scorm',host),true);
  const {editStudioCollection}=exported('src/lib/studioBlockCollections.ts',{crypto:{randomUUID:()=> 'uuid'}});
  const quiz={options:['A','B','C'],correctIndex:1,explanation:'keep'};
  const edited=editStudioCollection(quiz,'qcm','options','remove',1);
  assert.equal(edited.correctIndex,-1,'deleting the right answer must not assign a wrong answer as correct');
  assert.equal(edited.options.length,2);
  assert.equal(quiz.correctIndex,1,'original not mutated');
  assert.equal(edited.explanation,'keep');
  const moved=editStudioCollection(quiz,'qcm','options','down',1);
  assert.equal(moved.correctIndex,2,'right answer follows reorder');
  assert.throws(()=>editStudioCollection({options:['A','B']},'qcm','options','remove',0),/MINIMUM_COLLECTION_ITEMS/);
  const studio=fs.readFileSync(path.join(root,'src/pages/studio/StudioConceptionFormation.tsx'),'utf8');
  const player=fs.readFileSync(path.join(root,'src/components/ScormPlayer.tsx'),'utf8');
  assert.match(studio,/uploadSignedResource\(/);
  assert.match(studio,/mediaUppy\.addFile\(/);
  assert.match(studio,/Annuler le téléversement/);
  assert.match(player,/isTrustedScormMessage\(/);
  console.log('OGA_V4_MEDIA_SCORM_QCM_TESTS_SUCCESS — 20 contrats ciblés');
  console.log('Limites : pas de navigateur réel, Supabase, Cloudflare Stream ni Android.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
