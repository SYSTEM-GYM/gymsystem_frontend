import type { Metadata } from "next";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = {
  title: "Criar conta | CM Gym Connect",
};

export default function RegisterPage() {
  return <RegisterForm />;
}
