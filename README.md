# Knowledge OS — Cockpit Web

Interface web do sistema (React + Vite + Supabase). Pensada primeiro para o telemóvel; será instalável como app (PWA).

O "cérebro" (base de dados, IA, WhatsApp, calendário) está no Supabase. O código das Edge Functions e as migrações SQL estão no vault Obsidian, em `04. Assistente Pessoal/código/`.

## Ecrãs

- **Login**: link por email. Só entra o email configurado em `is_owner()` (migração 008); registos novos desligados no Supabase.
- **Inbox de Revisão**: itens em `PendingValidation`. Confirmar, editar (tipo, título, pessoas, grupos, tags, eventos, prazo), ignorar e resolver menções (ligar a existente, criando alias, ou criar pessoa nova).

## Configuração

Ficheiro `.env.local` (não vai para o Git):

```
VITE_SUPABASE_URL=https://<projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<publishable key>
```

A publishable key é pública por natureza (vai sempre para o browser). A proteção dos dados é o login + RLS.

## Comandos

```
npm run dev      # servidor local em http://localhost:5173
npm run build    # verifica tipos e gera a versão final em dist/
```
