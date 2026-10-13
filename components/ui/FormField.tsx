interface FormFieldProps {
  id: string;
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  autoComplete?: string;
  minLength?: number;
  defaultValue?: string;
  /** "glass" is the translucent style used on the photo-backed auth screens. */
  variant?: "default" | "glass";
}

const STYLES = {
  default: {
    label: "block text-sm font-medium text-zinc-400",
    input:
      "w-full rounded-2xl bg-surface-2 border border-white/5 px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30 transition",
  },
  glass: {
    label: "block text-sm font-medium text-bone/80",
    input:
      "w-full min-h-12 rounded-2xl bg-white/[0.06] border border-white/15 px-4 py-3 text-[15px] text-bone placeholder:text-bone/35 focus:outline-none focus:bg-white/[0.09] focus:border-volt/60 focus:ring-4 focus:ring-volt/15 transition",
  },
} as const;

export function FormField({
  id,
  name,
  label,
  type = "text",
  placeholder,
  required,
  autoComplete,
  minLength,
  defaultValue,
  variant = "default",
}: FormFieldProps) {
  const styles = STYLES[variant];

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        minLength={minLength}
        defaultValue={defaultValue}
        className={styles.input}
      />
    </div>
  );
}
