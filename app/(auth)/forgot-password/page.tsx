import type { Metadata } from "next";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Redefinir senha | CM Gym Connect",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
