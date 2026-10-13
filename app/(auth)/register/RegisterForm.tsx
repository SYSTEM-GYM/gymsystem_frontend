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

// UI only: public sign-up is not wired to Supabase yet. Swap onSubmit for
// useActionState(signUp, …) from app/auth/actions.ts when it goes live.
export function RegisterForm() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <>
      <AuthHeading
        title="Criar conta"
        subtitle="Cadastre-se para acompanhar seus treinos e entrar na academia pelo app."
      />

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
        }}
      >
        <FormField
          id="full_name"
          name="full_name"
          label="Nome completo"
          placeholder="Como está no seu documento"
          required
          autoComplete="name"
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
          variant="glass"
        />
        <FormField
          id="phone"
          name="phone"
          label="Celular (WhatsApp)"
          type="tel"
          placeholder="(00) 00000-0000"
          autoComplete="tel"
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

        {submitted && (
          <AuthNotice>
            O cadastro pelo app ainda não está disponível. Procure a recepção da sua academia
            para criar seu acesso.
          </AuthNotice>
        )}

        <AuthSubmitButton>Criar conta</AuthSubmitButton>
      </form>

      <AuthFooter>
        Já tem conta? <AuthTextLink href="/login">Voltar para o login</AuthTextLink>
      </AuthFooter>
    </>
  );
}
