"use client";

import { useActionState } from "react";
import { FormField } from "@/components/ui/FormField";
import {
  AuthFooter,
  AuthHeading,
  AuthNotice,
  AuthSubmitButton,
  AuthTextLink,
} from "@/components/auth/AuthUI";
import { requestPasswordReset, type PasswordResetState } from "@/app/auth/actions";

const initialState: PasswordResetState = {};

export function ForgotPasswordForm({ initialError }: { initialError?: string }) {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, initialState);

  return (
    <>
      <AuthHeading
        title="Redefinir senha"
        subtitle="Informe o e-mail da sua conta. Enviaremos um link para você criar uma nova senha."
      />

      <form action={formAction} className="space-y-4">
        <FormField
          id="email"
          name="email"
          label="E-mail"
          type="email"
          placeholder="seu@email.com"
          required
          autoComplete="email"
          variant="glass"
          defaultValue={state.email}
        />

        {/* Once the form is submitted, the action result replaces the link-expired notice */}
        {(state.error ?? (state.success ? undefined : initialError)) && (
          <AuthNotice tone="error">{state.error ?? initialError}</AuthNotice>
        )}
        {state.success && <AuthNotice>{state.success}</AuthNotice>}

        <AuthSubmitButton pending={isPending}>
          {isPending ? "Enviando…" : "Enviar link de redefinição"}
        </AuthSubmitButton>
      </form>

      <AuthFooter>
        Lembrou a senha? <AuthTextLink href="/login">Voltar para o login</AuthTextLink>
      </AuthFooter>
    </>
  );
}
