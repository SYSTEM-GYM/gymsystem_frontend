import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Entrar | CM Gym Connect",
};

export default function LoginPage() {
  return <LoginForm />;
}
