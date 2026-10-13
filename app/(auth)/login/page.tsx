import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar | CM Gym Connect",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ registered?: string }>;
}) {
  // ?registered=1 → sign-up succeeded but the automatic sign-in didn't
  const { registered } = await searchParams;
  const notice =
    registered === "1" ? "Conta criada. Entre com seu e-mail e senha." : undefined;

  return <LoginForm notice={notice} />;
}
