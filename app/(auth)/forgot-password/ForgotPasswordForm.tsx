"use client";

import { useState } from "react";
import { FormField } from "@/components/ui/FormField";
import {
  AuthFooter,
  AuthHeading,
  AuthNotice,
  AuthSubmitButton,
  AuthTextLink,
} from "@/components/auth/AuthUI";

// UI only: not wired to Supabase yet. Replace onSubmit with a server action
// calling supabase.auth.resetPasswordForEmail when the flow goes live.
export function ForgotPasswordForm() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
      <AuthHeading
        title="Redefinir senha"
        subtitle="Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha."
      />

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
        }}
      >
        <FormField
          id="email"
          name="email"
          label="E-mail"
          type="email"
          placeholder="seu@email.com"
          required
          autoComplete="email"
          variant="glass"
        />

        {submitted && (
          <AuthNotice>
            A redefinição por e-mail ainda não está disponível. Fale com a recepção da sua
            academia para trocar sua senha.
          </AuthNotice>
        )}

        <AuthSubmitButton>Enviar link de redefinição</AuthSubmitButton>
      </form>

      <AuthFooter>
        Lembrou a senha? <AuthTextLink href="/login">Voltar para o login</AuthTextLink>
      </AuthFooter>
    </>
  );
}
