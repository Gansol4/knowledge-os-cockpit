import { createClient } from '@supabase/supabase-js'

// Valores públicos por natureza (o URL e a chave "publishable/anon" vão sempre para o browser).
// A proteção dos dados é feita pelo login + políticas RLS no Supabase.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const configOk = Boolean(url && key)

export const supabase = createClient(url ?? 'http://localhost', key ?? 'missing')
