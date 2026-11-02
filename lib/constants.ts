// Dropdown options. These lists must match the CHECK constraints in supabase/schema.sql.

export const ROLES = [
  { value: "admin", label: "Admin (Owner)" },
  { value: "pharmacist", label: "Pharmacist" },
  { value: "sales_staff", label: "Sales Staff" },
] as const;

export type Role = (typeof ROLES)[number]["value"];

export const DOSAGE_FORMS = [
  "tablet",
  "capsule",
  "syrup",
  "injection",
  "cream",
  "drops",
  "inhaler",
  "other",
] as const;

export const CATEGORIES = [
  "Analgesic",
  "Antibiotic",
  "Antipyretic",
  "Gastrointestinal",
  "Antihistamine",
  "Cardiovascular",
  "Antidiabetic",
  "Respiratory",
  "Dermatological",
  "Vitamin & Supplement",
  "Other",
] as const;

export function roleLabel(role: string): string {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

/** Admin and Pharmacist can add and edit. */
export function canEdit(role: string): boolean {
  return role === "admin" || role === "pharmacist";
}

/** Only Admin can delete. */
export function canDelete(role: string): boolean {
  return role === "admin";
}
