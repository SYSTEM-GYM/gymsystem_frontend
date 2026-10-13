import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar | CM Gym Connect",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ confirm?: string }>;
}) {
  // ?confirm=error → /auth/confirm couldn't verify the e-mail link
  const { confirm } = await searchParams;
  const error =
    confirm === "error"
      ? "Link de confirmação inválido ou expirado. Entre com seu e-mail e senha; se a conta ainda não estiver ativa, faça o cadastro de novo para receber outro link."
      : undefined;

  return <LoginForm initialError={error} />;
}
