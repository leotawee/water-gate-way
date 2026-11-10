/** Constants and helpers shared by the admin pages (plain module — safe to import from server or client). */

export const ROLES = ["viewer", "operator", "admin"] as const;
export const ROLE_THAI: Record<string, string> = { viewer: "ผู้ชม", operator: "ผู้ควบคุม", admin: "ผู้ดูแลระบบ" };

type SearchParamsValue = string | string[] | undefined;

/** A searchParams entry may arrive repeated; filters read the first one only. */
export function firstParam(value: SearchParamsValue): string {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0] ?? "";
  return "";
}
