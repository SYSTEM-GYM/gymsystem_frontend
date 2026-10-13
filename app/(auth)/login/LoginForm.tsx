"use client";

import Link from "next/link";
import { useActionState } from "react";
import { FormField } from "@/components/ui/FormField";
import {
  AuthFooter,
  AuthHeading,
  AuthNotice,
  AuthSubmitButton,
  AuthTextLink,
} from "@/components/auth/AuthUI";
import { signIn, type AuthActionState } from "@/app/auth/actions";

const initialState: AuthActionState = {};

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <>
      <AuthHeading
        title="Entrar"
        subtitle="Use o e-mail e a senha cadastrados na sua academia."
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
        />
        <div>
          <FormField
            id="password"
            name="password"
            label="Senha"
            type="password"
            placeholder="••••••••"
            required
            autoComplete="current-password"
            variant="glass"
          />
          <div className="mt-2 flex justify-end">
            <Link
              href="/forgot-password"
              className="rounded py-1 text-sm text-bone/70 transition-colors hover:text-volt focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-volt"
            >
              Esqueci minha senha
            </Link>
          </div>
        </div>

        {state.error && <AuthNotice tone="error">{state.error}</AuthNotice>}

        <AuthSubmitButton pending={isPending}>
          {isPending ? "Entrando…" : "Entrar"}
        </AuthSubmitButton>
      </form>

      <AuthFooter>
        Ainda não tem conta? <AuthTextLink href="/register">Criar nova conta</AuthTextLink>
      </AuthFooter>
    </>
  );
}
