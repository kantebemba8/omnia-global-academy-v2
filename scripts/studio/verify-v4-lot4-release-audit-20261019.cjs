'use strict';
/** LOT 4 OGA - deterministic release-preflight; NOT live E2E or full TypeScript typecheck.
 * Run at project root: node scripts/studio/verify-v4-lot4-release-audit-20261019.cjs
 * Requires node and the project TypeScript dependency, as provided by npm ci.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../..');
process.chdir(root);
const ts = require('typescript');
const studioDir = path.join(root, 'scripts', 'studio');
const thisName = path.basename(__filename);
const scripts = fs.readdirSync(studioDir).filter(n => n.endsWith('.cjs') && n !== thisName).sort();
const result = {
  version: 'OGA_FORMATION_STUDIO_V4_LOT4',
  checks_type: 'LOCAL_STATIC_AND_UNIT_ONLY',
  scripts_total: scripts.length, scripts_passed: [], scripts_failed: [],
  parsed_typescript_files: 0, syntax_errors: [],
  ledger_unit_checks: 0,
  block_catalogue: '52_TYPES_STATIC_ONLY',
  browser_e2e: 'NOT_TESTED',
  supabase_live: 'NOT_TESTED',
  android_runtime: 'NOT_TESTED',
  original_T01_T55_matrix: 'NOT_AVAILABLE',
  final_release_approved: false,
};
for (const name of scripts) {
  try {
    execFileSync(process.execPath, [path.join(studioDir, name)], { cwd: root, timeout: 35000, stdio: 'pipe' });
    result.scripts_passed.push(name);
  } catch (e) {
    result.scripts_failed.push({ name, detail: String(e.stderr || e.message).slice(0, 800) });
  }
}
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const arr=[];
  for (const child of fs.readdirSync(dir, { withFileTypes: true })) {
    if (child.name === 'node_modules' || child.name === 'dist' || child.name === '.git') continue;
    const full = path.join(dir, child.name);
    if (child.isDirectory()) arr.push(...walk(full));
    else if (/\.tsx?$/.test(child.name)) arr.push(full);
  }
  return arr;
}
const typescriptFiles=[...walk(path.join(root, 'src')),...walk(path.join(root, 'supabase', 'functions'))];
for (const file of typescriptFiles) {
  const syntax=ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  for (const diagnostic of syntax.parseDiagnostics || []) {
    result.syntax_errors.push(`${path.relative(root,file)}: ${ts.flattenDiagnosticMessageText(diagnostic.messageText,' ')}`);
  }
  result.parsed_typescript_files++;
}
// Execute actual in-repo undo ledger as an isolated unit, without pretending it is UI E2E.
const ledgerPath=path.join(root, 'src/lib/studioUndoLedger.ts');
const transpiled=ts.transpileModule(fs.readFileSync(ledgerPath,'utf8'), {
  fileName: ledgerPath, compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}
}).outputText;
const moduleObject={ exports:{} };
vm.runInNewContext(transpiled, {module:moduleObject,exports:moduleObject.exports,Date}, {timeout:1500});
const ledger=moduleObject.exports.createStudioUndoLedger(4);
function check(fn){fn();result.ledger_unit_checks++;}
const command=(kind, at, key='a')=>({kind,lessonId:'L1',key,at,before:'A',after:'B'});
check(()=>assert.deepEqual(JSON.parse(JSON.stringify(ledger.sizes())),{undo:0,redo:0}));
const a=command('prose',1000,'a'),b=command('prose',1500,'a');
ledger.record(a);ledger.record(b);
check(()=>assert.equal(ledger.sizes().undo,1));
check(()=>assert.equal(ledger.undoCommand().after,'B'));
check(()=>assert.equal(ledger.completeUndo(a),true));
check(()=>assert.equal(ledger.sizes().redo,1));
check(()=>assert.equal(ledger.completeRedo(a),true));
check(()=>assert.equal(ledger.sizes().redo,0));
check(()=>assert.equal(ledger.completeUndo(command('structure',2000)),false));
check(()=>assert.equal(ledger.completeUndo(a),true));
ledger.record(command('structure',3000));
check(()=>assert.equal(ledger.sizes().redo,0));
ledger.clear();
check(()=>assert.equal(ledger.sizes().undo,0));
const outputArg=process.argv.slice(2).find(arg => arg.startsWith('--output='));
if (outputArg) {
  const resultPath=path.resolve(root,outputArg.slice('--output='.length));
  fs.mkdirSync(path.dirname(resultPath),{recursive:true});
  fs.writeFileSync(resultPath,JSON.stringify(result,null,2)+'\n');
}
console.log(JSON.stringify({scripts_passed:result.scripts_passed.length,scripts_failed:result.scripts_failed.length,parsed_typescript_files:result.parsed_typescript_files,syntax_errors:result.syntax_errors.length,ledger_unit_checks:result.ledger_unit_checks,final_release_approved:false,output:outputArg ? outputArg.slice('--output='.length) : 'stdout_only'},null,2));
if (result.scripts_failed.length || result.syntax_errors.length || result.scripts_passed.length<20) process.exitCode=1;
