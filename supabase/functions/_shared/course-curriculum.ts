export type CourseCurriculum = {
  modules: any[];
  lessons: any[];
  orderedLessons: any[];
  modulePosition: Record<string, number>;
  orphanLessonIds: string[];
};

export async function loadCourseCurriculum(sb: any, courseId: string): Promise<CourseCurriculum> {
  const { data: modules, error: moduleError } = await sb
    .from("course_modules")
    .select("id,title,objective,position,is_intro,is_conclusion,is_final_exam,is_required,section_type")
    .eq("course_id", courseId)
    .order("position");
  if (moduleError) throw moduleError;

  const { data: lessons, error: lessonError } = await sb
    .from("course_lessons")
    .select("id,course_id,module_id,title,position,cpd_calculated_time_seconds,is_free_preview,is_external,video_url,audio_url,is_intro,is_module_intro,is_conclusion,is_final_exam,is_required,stage_type")
    .eq("course_id", courseId)
    .order("position");
  if (lessonError) throw lessonError;

  const safeModules = modules || [];
  const safeLessons = lessons || [];
  const moduleIds = new Set(safeModules.map((m: any) => String(m.id)));
  const sectionRank = (mod: any) => {
    const type = String(mod.section_type || (mod.is_intro ? "introduction" : mod.is_conclusion ? "conclusion" : mod.is_final_exam ? "final_exam" : "module"));
    if (type === "introduction") return -100000;
    if (type === "conclusion") return 100000;
    if (type === "final_exam") return 200000;
    return Number(mod.position || 0);
  };
  const stageRank = (lesson: any) => {
    const type = String(lesson.stage_type || (lesson.is_intro ? "introduction" : lesson.is_module_intro ? "module_presentation" : lesson.is_conclusion ? "conclusion" : lesson.is_final_exam ? "final_exam" : "lesson"));
    if (type === "introduction") return -100000;
    if (type === "module_presentation") return -10000;
    if (type === "module_summary") return 10000;
    if (type === "conclusion") return 100000;
    if (type === "final_exam") return 200000;
    return Number(lesson.position || 0);
  };
  const modulePosition: Record<string, number> = {};
  for (const mod of safeModules) modulePosition[String(mod.id)] = sectionRank(mod);

  const orphanLessonIds = safeLessons
    .filter((lesson: any) => !moduleIds.has(String(lesson.module_id)))
    .map((lesson: any) => String(lesson.id));

  const orderedLessons = safeLessons
    .filter((lesson: any) => moduleIds.has(String(lesson.module_id)))
    .sort((a: any, b: any) =>
      (Number(modulePosition[String(a.module_id)] || 0) - Number(modulePosition[String(b.module_id)] || 0)) ||
      (stageRank(a) - stageRank(b)) ||
      String(a.id).localeCompare(String(b.id))
    );

  return { modules: safeModules, lessons: safeLessons, orderedLessons, modulePosition, orphanLessonIds };
}
