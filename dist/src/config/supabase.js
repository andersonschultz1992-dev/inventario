// ============================================================
// Configuração do Supabase
// ------------------------------------------------------------
// 1. Crie um projeto em https://supabase.com
// 2. Copie a URL e a chave "anon public" em Settings > API
// 3. Preencha abaixo e faça o commit normalmente.
//
// A chave anon é PÚBLICA por design — a segurança vem das
// políticas RLS criadas no database/schema.sql, nunca da chave.
// NUNCA coloque aqui a service_role key.
//
// Enquanto os campos estiverem vazios, a aplicação roda em
// MODO DEMO (somente leitura, dados do arquivo data/hosts.json).
// ============================================================

export const SUPABASE_URL = '';       // ex: 'https://xxxxx.supabase.co'
export const SUPABASE_ANON_KEY = '';  // ex: 'eyJhbGciOi...'

export const isConfigured = () =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
