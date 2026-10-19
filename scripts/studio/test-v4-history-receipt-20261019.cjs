/** Tests signed receipt primitives in isolation. NO remote Supabase assertions. */
const fs = require('node:fs');
const assert = require('node:assert/strict');
const vm = require('node:vm');
let ts; try {ts=require('typescript')} catch {ts=require('/opt/nvm/versions/node/v22.16.0/lib/node_modules/typescript')}
const source=fs.readFileSync('supabase/functions/studio-unified/index.ts','utf8');
const from=source.indexOf('const historyEncoder=');
const to=source.indexOf('const STUDIO_UPLOAD_BUCKETS=',from);
assert.ok(from>0 && to>from, 'receipt helpers are present');
const script=ts.transpileModule(source.slice(from,to)+'\nmodule.exports={signBlockHistory,verifyBlockHistory};',{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText;
const result={exports:{}};
const context={module:result,crypto:require('node:crypto').webcrypto,TextEncoder,TextDecoder,btoa,atob,
 Deno:{env:{get:(key)=>key==='SUPABASE_SERVICE_ROLE_KEY'?'test-only-secret':null}},console,Date,Uint8Array,JSON,String};
vm.runInNewContext(script,context,{timeout:1500});
(async()=>{
 const payload={v:1,until:Date.now()+300000,userId:'u',courseId:'c',block:{id:'b',content_json:{title:'À retenir'}},remaining:['a']};
 const receipt=await result.exports.signBlockHistory(payload);
 const decoded=await result.exports.verifyBlockHistory(receipt);
 assert.equal(decoded.userId,'u');assert.equal(decoded.block.content_json.title,'À retenir');
 // Tamper a SIGNIFICANT Base64URL character: changing the final character can
 // alter only unused padding bits and leave the decoded HMAC bytes identical.
 const [body, signature] = receipt.split('.');
 assert.ok(body && signature, 'signed receipt has payload and signature');
 const alteredSignature = (signature[0] === 'A' ? 'B' : 'A') + signature.slice(1);
 assert.notEqual(alteredSignature, signature);
 assert.equal(await result.exports.verifyBlockHistory(`${body}.${alteredSignature}`),null,
   'a cryptographically changed signature must be rejected');
 const expired=await result.exports.signBlockHistory({...payload,until:Date.now()-1});
 assert.equal(await result.exports.verifyBlockHistory(expired),null);
 console.log('STUDIO_HISTORY_RECEIPT_HMAC_PASS');
})().catch(err=>{console.error(err);process.exitCode=1});
