import type { Role } from "@/lib/types";

export function detectRole(maker: string | null, checker: string | null, person = "Bryan"): Role {
  const target = person.trim().toLocaleLowerCase();
  if (maker?.trim().toLocaleLowerCase() === target) return "MAKER";
  if (checker?.trim().toLocaleLowerCase() === target) return "CHECKER";
  return "NOT_ASSIGNED";
}
