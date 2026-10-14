import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Redefinir senha | CM Gym Connect",
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ link?: string }>;
}) {
  // ?link=expired → the recovery link was invalid/expired or its session is gone
  const { link } = await searchParams;
  const error =
    link === "expired"
      ? "Link de redefinição inválido ou expirado. Informe seu e-mail para receber um novo link."
      : undefined;

  return <ForgotPasswordForm initialError={error} />;
}
