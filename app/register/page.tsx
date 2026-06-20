"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AuthCard } from "@/components/ui/AuthCard";
import { FormField } from "@/components/ui/FormField";
import { signUp, type AuthActionState } from "@/app/auth/actions";

const initialState: AuthActionState = {};

export default function RegisterPage() {
  const [state, formAction, isPending] = useActionState(signUp, initialState);

  return (
    <AuthCard>
      <h1 className="text-xl font-bold text-white mb-1">Criar sua conta</h1>
      <p className="text-sm text-zinc-500 mb-6">
        Comece sua jornada na academia 🏋️
      </p>

      {state.success ? (
        <div className="space-y-4">
          <p className="text-sm text-info bg-info/10 border border-info/20 rounded-2xl px-4 py-3">
            {state.success}
          </p>
          <Link
            href="/login"
            className="block w-full text-center bg-primary text-black font-semibold py-2.5 rounded-full hover:scale-[1.02] transition-transform text-sm"
          >
            Ir para o login
          </Link>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <FormField
            id="full_name"
            name="full_name"
            label="Nome completo"
            placeholder="João da Silva"
            required
            autoComplete="name"
          />
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
            placeholder="Mínimo 6 caracteres"
            required
            autoComplete="new-password"
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
            {isPending ? "Criando conta…" : "Criar conta"}
          </button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-zinc-600">
        Já tem uma conta?{" "}
        <Link
          href="/login"
          className="text-primary hover:text-primary/80 font-medium transition-colors"
        >
          Entrar
        </Link>
      </p>
    </AuthCard>
  );
}
