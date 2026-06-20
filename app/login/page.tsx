"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthCard } from "@/components/ui/AuthCard";
import { FormField } from "@/components/ui/FormField";
import { signIn, type AuthActionState } from "@/app/auth/actions";

const initialState: AuthActionState = {};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <AuthCard>
      <h1 className="text-xl font-bold text-white mb-1">Entrar na sua conta</h1>
      <p className="text-sm text-zinc-500 mb-6">Bem-vindo de volta 👋</p>

      <form action={formAction} className="space-y-4">
        <FormField
          id="email"
          name="email"
          label="E-mail"
          type="email"
          placeholder="seu@email.com"
          required
          autoComplete="email"
        />
        <FormField
          id="password"
          name="password"
          label="Senha"
          type="password"
          placeholder="••••••••"
          required
          autoComplete="current-password"
        />

        {state.error && (
          <p
            role="alert"
            className="text-sm text-danger bg-danger/10 border border-danger/20 rounded-2xl px-4 py-2.5"
          >
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-primary text-black font-semibold py-2.5 rounded-full hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed transition-transform text-sm mt-2"
        >
          {isPending ? "Entrando…" : "Entrar"}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        Não tem uma conta?{" "}
        <Link
          href="/register"
          className="text-primary hover:text-primary/80 font-medium transition-colors"
        >
          Criar conta
        </Link>
      </p>
    </AuthCard>
  );
}
