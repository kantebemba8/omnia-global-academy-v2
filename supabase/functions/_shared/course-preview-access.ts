import { hasStructurePermission, validatedStructureAccess } from "./structure-access.ts";

export async function canPreviewCourse(
  sb: any,
  userId: string,
  courseId: string,
  permission = "can_edit_courses",
): Promise<boolean> {
  const { data: course, error } = await sb
    .from("courses")
    .select("creator_id,creator_context,structure_id")
    .eq("id", courseId)
    .maybeSingle();
  if (error || !course) return false;

  const { data: roleRows } = await sb.from("user_roles").select("role").eq("user_id", userId);
  if ((roleRows || []).some((row: any) => row.role === "super_admin")) return true;

  // Une formation portée par une Structure peut être contrôlée par tout membre
  // validé disposant de la permission correspondante, pas uniquement par le
  // compte qui a créé le brouillon initial.
  if (String(course.creator_context || "") === "structure" && course.structure_id) {
    const access = await validatedStructureAccess(sb, userId, String(course.structure_id));
    if (access && hasStructurePermission(access, permission)) return true;
  }

  return String(course.creator_id || "") === userId;
}
