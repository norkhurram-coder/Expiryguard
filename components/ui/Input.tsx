// Form fields: a label, the input itself, and a red error message underneath.
import type { UseFormRegisterReturn } from "react-hook-form";

const fieldStyle =
  "w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none transition focus:ring-2 focus:ring-teal-brand/30";

function borderColor(error?: string) {
  return error ? "border-coral focus:border-coral" : "border-teal-line focus:border-teal-brand";
}

type FieldProps = {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
};

export function Field({ label, error, hint, required, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-ink">
        {label} {required && <span className="text-coral">*</span>}
      </span>
      {children}
      {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
      {error && (
        <span role="alert" className="mt-1 block text-xs font-medium text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}

type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  hint?: string;
  registration: UseFormRegisterReturn;
};

/** Text, email, password, number or date input connected to React Hook Form. */
export function Input({ label, error, hint, registration, required, ...props }: InputProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required}>
      <input
        className={`${fieldStyle} ${borderColor(error)}`}
        aria-invalid={!!error}
        required={required}
        {...props}
        {...registration}
      />
    </Field>
  );
}

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  registration: UseFormRegisterReturn;
  placeholder: string;
  options: { value: string | number; label: string }[];
};

/** Dropdown connected to React Hook Form. */
export function Select({ label, error, registration, placeholder, options, required, ...props }: SelectProps) {
  return (
    <Field label={label} error={error} required={required}>
      <select
        className={`${fieldStyle} ${borderColor(error)}`}
        aria-invalid={!!error}
        required={required}
        {...props}
        {...registration}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
