export type PlanType = "basic" | "premium" | "vip";

export type AnamnesisKey =
  | "cardiac"
  | "diabetes"
  | "hypertension"
  | "respiratory"
  | "musculoskeletal"
  | "surgery"
  | "medication"
  | "pregnancy";

export type AnamnesisData = Partial<Record<AnamnesisKey, boolean>>;

export const ANAMNESIS_FIELDS: { label: string; key: AnamnesisKey }[] = [
  { label: "Doenças Cardíacas", key: "cardiac" },
  { label: "Diabetes", key: "diabetes" },
  { label: "Hipertensão", key: "hypertension" },
  { label: "Problemas Respiratórios", key: "respiratory" },
  { label: "Lesões Musculares / Ósseas", key: "musculoskeletal" },
  { label: "Cirurgias Recentes", key: "surgery" },
  { label: "Uso de Medicamentos", key: "medication" },
  { label: "Gravidez / Pós-parto", key: "pregnancy" },
];

export const PLAN_OPTIONS: { value: PlanType; label: string }[] = [
  { value: "basic", label: "Básico" },
  { value: "premium", label: "Premium" },
  { value: "vip", label: "VIP" },
];

export function stripDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function formatCPF(raw: string): string {
  const d = stripDigits(raw).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

export function formatPhone(raw: string): string {
  const d = stripDigits(raw).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function isValidCPF(cpf: string): boolean {
  const d = stripDigits(cpf);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(d[i], 10) * (10 - i);
  let rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  if (rest !== parseInt(d[9], 10)) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(d[i], 10) * (11 - i);
  rest = (sum * 10) % 11;
  if (rest === 10) rest = 0;
  return rest === parseInt(d[10], 10);
}

export function parseAnamnesisData(raw: unknown): AnamnesisData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: AnamnesisData = {};
  for (const { key } of ANAMNESIS_FIELDS) {
    if (key in raw && typeof (raw as Record<string, unknown>)[key] === "boolean") {
      out[key] = (raw as Record<string, boolean>)[key];
    }
  }
  return out;
}
