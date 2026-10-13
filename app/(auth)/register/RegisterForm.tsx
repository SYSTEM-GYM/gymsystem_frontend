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
import { signUp, type SignUpState } from "@/app/auth/actions";

const initialState: SignUpState = {};

export function RegisterForm() {
  const [state, formAction, isPending] = useActionState(signUp, initialState);
  const values = state.values;

  return (
    <>
      <AuthHeading
        title="Criar conta"
        subtitle="Cadastre-se para acompanhar seus treinos e entrar na academia pelo app."
      />

      <form action={formAction} className="space-y-4" aria-busy={isPending}>
        <FormField
          id="full_name"
          name="full_name"
          label="Nome completo"
          placeholder="Como está no seu documento"
          required
          autoComplete="name"
          defaultValue={values?.full_name}
          variant="glass"
        />
        <FormField
          id="email"
          name="email"
          label="E-mail"
          type="email"
          placeholder="seu@email.com"
          required
          autoComplete="email"
          defaultValue={values?.email}
          variant="glass"
        />
        <FormField
          id="phone"
          name="phone"
          label="Celular (WhatsApp)"
          type="tel"
          placeholder="(00) 00000-0000"
          autoComplete="tel"
          defaultValue={values?.phone}
          variant="glass"
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <FormField
            id="password"
            name="password"
            label="Senha"
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
            label="Confirmar senha"
            type="password"
            placeholder="Repita a senha"
            required
            minLength={8}
            autoComplete="new-password"
            variant="glass"
          />
        </div>

        <label className="flex cursor-pointer items-start gap-3 py-1 text-sm leading-snug text-bone/70">
          <input
            type="checkbox"
            name="terms"
            required
            className="mt-0.5 size-5 shrink-0 cursor-pointer rounded-md accent-leaf"
          />
          Li e aceito os termos de uso e a política de privacidade da academia.
        </label>

        {state.error && <AuthNotice tone="error">{state.error}</AuthNotice>}

        <AuthSubmitButton pending={isPending}>
          {isPending ? "Criando sua conta…" : "Criar conta"}
        </AuthSubmitButton>
      </form>

      <AuthFooter>
        Já tem conta? <AuthTextLink href="/login">Voltar para o login</AuthTextLink>
      </AuthFooter>
    </>
  );
}
