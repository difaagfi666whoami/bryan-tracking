import { config } from "@/lib/config";

export function isExemptRemark(remark: string | null): boolean {
  const normalized = (remark ?? "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
  return normalized.length > 0 && config.exemptionKeywords.some((keyword) => normalized.includes(keyword));
}
