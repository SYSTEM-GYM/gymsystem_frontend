export function buildWhatsAppUrl(
  phone: string | null,
  studentName: string,
  amount: number
): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const formatted = digits.startsWith("55") ? digits : `55${digits}`;
  const amountStr = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(amount);
  const msg = encodeURIComponent(
    `Olá ${studentName}! 👋 Identificamos uma fatura em aberto no valor de ${amountStr}. Entre em contato para regularizar sua situação. Obrigado! 🏋️`
  );
  return `https://wa.me/${formatted}?text=${msg}`;
}
