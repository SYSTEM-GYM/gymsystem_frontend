<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# SIMP Frontend — Guia para Agentes

## Blueprint

Consulte o blueprint completo em:
- **Obsidian:** `../SYSTEM-GYM/SIMP - Blueprint Fase 2.md`
- **Resumo:** `../ARCHITECTURE-BLUEPRINT.md`

## Estrutura

| Rota | Público | Descrição |
|------|---------|-----------|
| `/dashboard/*` | Admin | CRM, financeiro, configurações |
| `/app/*` | Aluno | Treino, QR, perfil (mobile first) |
| `/login` | Público | Autenticação |

## Prioridade Zero

1. Anamnese: checkboxes funcionais em `SmartProfile.tsx` + auto-save
2. Formulário alunos: edição inline CPF/Filial/Telefone
3. Status: Ativo/Inativo/Banido em `StatusToggleButton.tsx`

## Diretrizes UX

- Optimistic UI em cliques (curtir, salvar, marcar exercício)
- Skeleton loaders (nunca spinner genérico)
- Infinite scroll para listas longas
- Touch targets ≥ 44px no `/app`
- Vídeos: lazy load só ao abrir modal (`ExerciseVideoModal.tsx`)

## Segurança

- Zero Trust: validação server-side em `actions.ts`
- DOMPurify para conteúdo de usuário
- Nunca expor service role key no client
