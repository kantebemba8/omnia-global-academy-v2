const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const project=path.resolve(__dirname,'../..');
const studio=fs.readFileSync(path.join(project,'supabase/functions/studio-unified/index.ts'),'utf8');
const progress=fs.readFileSync(path.join(project,'supabase/functions/course-progress/index.ts'),'utf8');
const reader=fs.readFileSync(path.join(project,'supabase/functions/lesson-content/index.ts'),'utf8');
const verify=(condition,message)=>{assert.ok(condition,message);};
const guardedActions=['assessment_section_create','assessment_section_update','assessment_section_delete','assessment_question_design_update','assessment_add_training_blocks','question_bank_add_to_assessment'];
for (const action of guardedActions){
  const start=studio.indexOf(`if(action==="${action}"){`);
  const next=studio.indexOf('\n  if(action===',start+15);
  verify(start>=0,`${action} must exist`);
  const branch=studio.slice(start,next<0?undefined:next);
  verify(/editableAssessmentDraft\(/.test(branch),`${action}: guard is required`);
  verify(branch.indexOf('await owns(')<branch.indexOf('editableAssessmentDraft('),`${action}: enforce ownership before edit guard`);
}
verify(studio.includes('if(questionCountError)throw questionCountError'), 'section delete must fail closed if question count fails');
verify(studio.includes('if(policyAttemptsError)throw policyAttemptsError'), 'policy lookup must fail closed');
verify(studio.includes('ASSESSMENT_POLICY_ATTEMPTS_EXIST'), 'history must block policy rewriting');
verify(studio.includes('if(courseState.is_published===true'), 'published assessment lifecycle must be protected');
verify(studio.includes('module_id,required,is_active,passing_score'), 'quality checker needs active status');
verify(studio.includes('moduleAssessment?.is_active===false'), 'mandatory module examination must be active for publication');
verify(studio.includes('lessonAssessment?.is_active===false'), 'mandatory lesson evaluation must be active for publication');
verify(studio.includes('finalAssessment?.is_active===false'), 'mandatory final examination must be active for publication');
verify(studio.includes('for(const write of durationWrites){if(write?.error)throw write.error;}'), 'duration write failure must not be ignored');
verify(progress.includes('earlierRequiredModules.filter((candidate:any)=>candidate.is_required!==false).every(moduleGatePassed)'), 'all previous modules required');
verify(progress.includes('is_unlocked:previewAllowed||!sequential||mod.is_intro||previousPassed'), 'nonsequential course unlock parity');
verify(reader.includes('lesson.is_conclusion?"conclusion":lesson.is_final_exam?"final_exam"'), 'old special flags must be respected for server gate');

// Execute the actual extracted server guard with a small Supabase query double.
const start=studio.indexOf('  async function editableAssessmentDraft(assessmentId:string){');
const end=studio.indexOf('\n  if(action==="assessment_composition_get")',start);
verify(start>=0&&end>start,'guard is inspectable');
const source=studio.slice(start,end).replace('assessmentId:string','assessmentId');
function mockedDb(options={}) {
  const seen=[];
  return {
    seen,
    from(table){
      seen.push(table);
      const query={
        table,select(){return this},eq(){return this},
        async maybeSingle(){
          if(table==='course_assessments')return {data:options.assessment===null?null:options.assessment||{id:'assessment-1',course_id:'course-1'},error:options.assessmentError||null};
          if(table==='courses')return {data:options.course===null?null:options.course||{studio_status:'draft',is_published:false},error:options.courseError||null};
          return {data:null,error:null};
        },
        then(resolve,reject){return Promise.resolve({count:options.count??0,error:options.attemptError||null}).then(resolve,reject)}
      };
      return query;
    }
  };
}
const makeGuard=new Function('sb',`${source}\nreturn editableAssessmentDraft;`);
(async()=>{
  const cases=[
    [{},null],
    [{assessment:null},'ASSESSMENT_NOT_FOUND'],
    [{course:null},'COURSE_NOT_FOUND'],
    [{course:{studio_status:'draft',is_published:true}},'ASSESSMENT_VERSION_LOCKED'],
    [{course:{studio_status:'submitted',is_published:false}},'ASSESSMENT_VERSION_LOCKED'],
    [{course:{studio_status:'pending_validation',is_published:false}},'ASSESSMENT_VERSION_LOCKED'],
    [{count:1},'ASSESSMENT_ATTEMPTS_EXIST'],
    [{count:100},'ASSESSMENT_ATTEMPTS_EXIST'],
  ];
  for(const [input,error] of cases){const db=mockedDb(input);const result=await makeGuard(db)('assessment-1');assert.equal(result?.error??null,error);}
  const errorDb=mockedDb({attemptError:new Error('DATABASE_ERROR')});
  await assert.rejects(()=>makeGuard(errorDb)('assessment-1'),/DATABASE_ERROR/);
  console.log(`LOT3_ASSESSMENTS_PROGRESS_PASS (${guardedActions.length} protected mutation paths, ${cases.length+1} guard cases)`);
})().catch(error=>{console.error(error);process.exitCode=1;});
