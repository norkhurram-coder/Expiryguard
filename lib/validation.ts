// All form validation rules in one place (Zod).
// The same rules are also enforced in the database with CHECK constraints.
import { z } from "zod";
import { CATEGORIES, DOSAGE_FORMS } from "./constants";
import { addDays, todayISO } from "./expiry";

// ---------- reusable field rules ----------

const email = z
  .string()
  .trim()
  .min(1, "Email is required")
  .pipe(z.email("Enter a valid email, e.g. name@example.com"));

const personName = (label: string) =>
  z
    .string()
    .trim()
    .min(2, `${label} must be at least 2 letters`)
    .max(50, `${label} must be 50 characters or less`)
    .regex(/^[A-Za-z ]+$/, `${label} can only contain letters and spaces`);

const phone = z
  .string()
  .trim()
  .regex(/^03\d{9}$/, "Enter an 11-digit mobile number starting with 03, e.g. 03001234567");

/** A whole number between min and max. Empty number boxes arrive as NaN. */
const wholeNumber = (label: string, min: number, max: number) =>
  z
    .number({ error: `${label} is required` })
    .int(`${label} must be a whole number`)
    .min(min, `${label} must be at least ${min}`)
    .max(max, `${label} must be at most ${max.toLocaleString()}`);

const textBetween = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(min, min === 1 ? `${label} is required` : `${label} must be at least ${min} characters`)
    .max(max, `${label} must be ${max} characters or less`);

const price = (label: string) =>
  z
    .number({ error: `${label} is required` })
    .positive(`${label} must be more than 0`)
    .max(1_000_000, `${label} is too large`)
    .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 1e-6, `${label} can have at most 2 decimal places`);

// ---------- password rules (also used for the live checklist) ----------

export const PASSWORD_RULES = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "One uppercase letter (A–Z)", test: (p: string) => /[A-Z]/.test(p) },
  { label: "One lowercase letter (a–z)", test: (p: string) => /[a-z]/.test(p) },
  { label: "One number (0–9)", test: (p: string) => /\d/.test(p) },
  { label: "One special character (!@#$…)", test: (p: string) => /[^A-Za-z0-9]/.test(p) },
];

// ---------- forms ----------

export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const signupSchema = z
  .object({
    full_name: personName("Full name"),
    age: wholeNumber("Age", 18, 70),
    phone,
    role: z.enum(["admin", "pharmacist", "sales_staff"], { error: "Please choose a role" }),
    email,
    password: z
      .string()
      .min(1, "Password is required")
      .refine((p) => PASSWORD_RULES.every((rule) => rule.test(p)), "Password does not meet all the rules below"),
    confirm_password: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });
export type SignupValues = z.infer<typeof signupSchema>;

export const supplierSchema = z.object({
  name: textBetween("Supplier name", 2, 100),
  contact_person: personName("Contact person"),
  phone,
  email,
  address: z.string().trim().max(200, "Address must be 200 characters or less"),
  return_window_days: wholeNumber("Return window", 0, 365),
});
export type SupplierValues = z.infer<typeof supplierSchema>;

export const medicineSchema = z.object({
  brand_name: textBetween("Brand name", 2, 100),
  generic_name: textBetween("Generic name", 2, 100),
  strength: textBetween("Strength", 1, 30),
  dosage_form: z.enum(DOSAGE_FORMS, { error: "Please choose a dosage form" }),
  category: z.enum(CATEGORIES, { error: "Please choose a category" }),
  rack_location: z
    .string()
    .trim()
    .max(20, "Rack location must be 20 characters or less")
    .regex(/^[A-Za-z0-9-]*$/, "Use only letters, numbers and hyphens, e.g. A-3"),
  min_stock_level: wholeNumber("Minimum stock level", 0, 10_000),
});
export type MedicineValues = z.infer<typeof medicineSchema>;

export const batchSchema = z.object({
  medicine_id: z.number({ error: "Please choose a medicine" }).int().positive("Please choose a medicine"),
  supplier_id: z.number({ error: "Please choose a supplier" }).int().positive("Please choose a supplier"),
  batch_no: z
    .string()
    .trim()
    .min(2, "Batch number must be at least 2 characters")
    .max(30, "Batch number must be 30 characters or less")
    .regex(/^[A-Za-z0-9-]+$/, "Use only letters, numbers and hyphens"),
  // FR-03: expiry must be after today, and not more than 10 years away.
  // (Dates in YYYY-MM-DD form can be compared as text.)
  expiry_date: z
    .string()
    .min(1, "Expiry date is required")
    .refine((d) => d > todayISO(), "Expiry date must be after today – expired stock cannot be added")
    .refine((d) => d <= addDays(todayISO(), 3653), "Expiry date must be within 10 years"),
  quantity: wholeNumber("Quantity", 1, 100_000),
  purchase_price: price("Purchase price"),
  sale_price: price("Sale price"),
});
export type BatchValues = z.infer<typeof batchSchema>;
