/* OGA V4 — contrats contrôlés après consolidation (PAS des tests E2E). */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const get=f=>fs.readFileSync(path.join(root,f),'utf8');
const studio=get('supabase/functions/studio-unified/index.ts');
const progress=get('supabase/functions/course-progress/index.ts');
const lesson=get('supabase/functions/lesson-content/index.ts');
const builder=get('src/pages/studio/StudioConceptionFormation.tsx');
const reader=get('src/pages/CoursLecteur.tsx');
const sql=get('supabase/migrations/20261017205000_193_oga_studio_v4_assessments_atomic.sql');
let pass=0;
function check(label,condition){assert.ok(condition,label);pass++;console.log('PASS',label)}
check('Programme intro sans examen officiel',studio.includes('OFFICIAL_ASSESSMENT_NOT_ALLOWED_ON_STAGE')&&lesson.includes('is_intro'));
check('Bilan de module rattachement dédié',builder.includes('async function openModuleAssessment')&&builder.includes("stage_type: 'module_summary'"));
check('Évaluation de leçon configurée explicitement, sans l’imposer',builder.includes("stageTypeOf(currentLesson) === 'module_summary'") && builder.includes("selectAssessmentWorkspace(currentModule, currentLesson, scope)"));
check('Examen final optionnel et révocable en brouillon',studio.includes('FINAL_EXAM_ONLY_REMOVABLE_IN_DRAFT')&&studio.includes('FINAL_EXAM_HAS_ATTEMPTS'));
check('Contrôle des scopes non destructif',studio.includes('ASSESSMENT_SCOPE_CONFLICT')&&studio.includes('ASSESSMENT_SCOPE_REQUIRES_EXPLICIT_MIGRATION'));
check('Synchronisation ne supprime pas les anciennes questions',!studio.slice(studio.indexOf('if(action==="ensure_assessments")'),studio.indexOf('if(action==="assessment_policy_get")')).includes('assessment_questions").delete()'));
check('Protection historique avant édition',studio.includes('await ensureOfficialQuestionHistoryEditable(sb,String(blk.id))'));
check('Protection historique avant suppression bloc',studio.includes('await ensureOfficialQuestionHistoryEditable(sb,String(b.block_id))'));
check('Protection historique avant suppression leçon/module',(studio.match(/hasStageAssessmentAttempts\(/g)||[]).length>=3);
check('Aucun examen vide soumis',studio.includes('error:"ASSESSMENT_EMPTY"'));
check('Publication résultats seulement après releaseNow',studio.includes('if(releaseNow&&passed&&a.scope==="final")'));
check('Durée recalculable sur cours existants',studio.includes('ensurePublishedDurationEngineMigration')&&studio.includes('recalculateCourseDuration'));
check('Recalcul durée idempotent',studio.includes('Number(lesson.cpd_calculated_time_seconds||0)===seconds'));
check('Durée cours sans mise à jour de sa date éditoriale',studio.includes('calculated_duration_minutes:minutes,total_duration_seconds:minutes*60})'));
check('Acquis apprenant conservés après recalibrage',lesson.includes('progress?.is_completed===true||(cpdReached'));
check('Progression évaluations: seulement résultats publiés',progress.includes('row.result_status==="published"'));
check('Progression vers module suivant sécurisée',progress.includes('priorModules.filter')&&progress.includes('moduleGatePassed'));
check('Accès direct au module suivant protégé',lesson.includes('realModules.slice(0,targetModuleIndex)'));
check('Conclusion verrouillée avant validations',lesson.includes('COURSE_SEQUENCE_LOCKED'));
check('Navigation lecteur vérifie verrou serveur',reader.includes('nextLocked')&&reader.includes('targetLesson.is_unlocked === false'));
check('Politique atomique versionnée',studio.includes('oga_studio_v4_193_apply_policy')&&sql.includes('CREATE OR REPLACE FUNCTION public.oga_studio_v4_193_apply_policy'));
check('Remise atomique versionnée',studio.includes('oga_studio_v4_193_submit_assessment')&&sql.includes('pg_advisory_xact_lock'));
check('Fichiers de copies insérés dans transaction',sql.includes('INSERT INTO public.assessment_submission_files'));
check('RPC non accessibles aux apprenants',sql.includes('REVOKE ALL ON FUNCTION public.oga_studio_v4_193_submit_assessment')&&sql.includes('TO service_role'));
check('Centre Qualité vérifié avant publication',studio.includes('runCourseChecklist("publication")'));
check('8 langues pédagogiques présentes',['fr','en','es','pt','ar','zh','ru','de'].every(l=>studio.includes(l+':{')));
let ts;
try {ts=require('typescript')} catch { /* devDependency pas installée dans certaines copies */ }
if(ts){for(const file of ['supabase/functions/studio-unified/index.ts','supabase/functions/course-progress/index.ts','supabase/functions/lesson-content/index.ts','src/pages/studio/StudioConceptionFormation.tsx','src/pages/CoursLecteur.tsx']){let source=ts.createSourceFile(file,get(file),ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);check('Syntaxe TS '+file,source.parseDiagnostics.length===0)}}
console.log(`OGA_V4_PEDAGOGIE_CONSOLIDATION_TESTS_SUCCESS ${pass} contrôles de source${ts?' et syntaxe':''}; navigateur/SQL distant/Android NON TESTÉS`);
