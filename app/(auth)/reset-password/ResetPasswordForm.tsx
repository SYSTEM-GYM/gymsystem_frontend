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
import { updatePassword, type AuthActionState } from "@/app/auth/actions";

const initialState: AuthActionState = {};

export function ResetPasswordForm({ email }: { email: string | null }) {
  const [state, formAction, isPending] = useActionState(updatePassword, initialState);

  return (
    <>
      <AuthHeading
        title="Criar nova senha"
        subtitle={email ? `Defina a nova senha da conta ${email}.` : "Defina a nova senha da sua conta."}
      />

      <form action={formAction} className="space-y-4">
        <FormField
          id="password"
          name="password"
          label="Nova senha"
          type="password"
          placeholder="Mínimo de 8 caracteres"
          required
          minLength={8}
          autoComplete="new-password"
          variant="glass"
        />
        <FormField
          id="password_confirm"
          name="password_confirm"
          label="Confirmar nova senha"
          type="password"
          placeholder="Repita a nova senha"
          required
          minLength={8}
          autoComplete="new-password"
          variant="glass"
        />

        {state.error && <AuthNotice tone="error">{state.error}</AuthNotice>}

        <AuthSubmitButton pending={isPending}>
          {isPending ? "Salvando…" : "Salvar nova senha"}
        </AuthSubmitButton>
      </form>

      <AuthFooter>
        Link expirado? <AuthTextLink href="/forgot-password">Pedir um novo link</AuthTextLink>
      </AuthFooter>
    </>
  );
}
