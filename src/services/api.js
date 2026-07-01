// ============================================================
// Camada de dados — abstrai Supabase x modo demo (JSON local)
// A UI só conversa com este módulo.
// ============================================================
import { SUPABASE_URL, SUPABASE_ANON_KEY, isConfigured } from '../config/supabase.js';

let supabase = null;
let demoHosts = null;

export const MODE = isConfigured() ? 'supabase' : 'demo';

export async function init() {
  if (MODE === 'supabase') {
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return supabase;
  }
  const res = await fetch('data/hosts.json');
  const raw = await res.json();
  demoHosts = raw.map((h, i) => ({ id: i + 1, ...h }));
  return null;
}

export function getClient() { return supabase; }

// ---------- Leitura ----------

export async function fetchHosts() {
  if (MODE === 'demo') return [...demoHosts];
  const { data, error } = await supabase
    .from('hosts_view')
    .select('*')
    .order('hostname');
  if (error) throw error;
  return data;
}

export async function fetchLookups() {
  if (MODE === 'demo') {
    const uniq = (arr) => [...new Set(arr.filter(Boolean))].sort();
    return {
      times: uniq(demoHosts.map(h => h.time)).map((sigla, i) => ({ id: i + 1, sigla })),
      tecnologias: uniq(demoHosts.flatMap(h => h.tecnologias)).map((nome, i) => ({ id: i + 1, nome })),
      dominios: uniq(demoHosts.map(h => h.dominio)).map((nome, i) => ({ id: i + 1, nome })),
      negocios: uniq(demoHosts.map(h => h.negocio)).map((nome, i) => ({ id: i + 1, nome })),
    };
  }
  const [times, tecnologias, dominios, negocios] = await Promise.all([
    supabase.from('times').select('id, sigla').order('sigla'),
    supabase.from('tecnologias').select('id, nome').order('nome'),
    supabase.from('dominios').select('id, nome').order('nome'),
    supabase.from('negocios').select('id, nome').order('nome'),
  ]);
  for (const r of [times, tecnologias, dominios, negocios]) if (r.error) throw r.error;
  return { times: times.data, tecnologias: tecnologias.data, dominios: dominios.data, negocios: negocios.data };
}

// ---------- Escrita (somente Supabase) ----------

function assertWritable() {
  if (MODE === 'demo') {
    const e = new Error('Modo demo: configure o Supabase em src/config/supabase.js para habilitar edição.');
    e.demo = true;
    throw e;
  }
}

// Garante que um lookup existe e retorna o id (upsert por nome)
async function ensureLookup(table, column, value) {
  if (!value) return null;
  const { data: found } = await supabase.from(table).select('id').eq(column, value).maybeSingle();
  if (found) return found.id;
  const { data, error } = await supabase.from(table).insert({ [column]: value }).select('id').single();
  if (error) throw error;
  return data.id;
}

export async function hostnameExists(hostname, ignoreId = null) {
  if (MODE === 'demo') {
    return demoHosts.some(h => h.hostname.toLowerCase() === hostname.toLowerCase() && h.id !== ignoreId);
  }
  let q = supabase.from('hosts').select('id').ilike('hostname', hostname);
  if (ignoreId) q = q.neq('id', ignoreId);
  const { data, error } = await q;
  if (error) throw error;
  return data.length > 0;
}

export async function saveHost(form, editingId = null) {
  assertWritable();

  const [timeRow] = (await supabase.from('times').select('id').eq('sigla', form.time)).data ?? [];
  const dominioId = await ensureLookup('dominios', 'nome', form.dominio);
  const negocioId = await ensureLookup('negocios', 'nome', form.negocio);

  const payload = {
    hostname: form.hostname,
    time_id: timeRow?.id ?? null,
    dominio_id: dominioId,
    negocio_id: negocioId,
    versao_so: form.versao_so || null,
    tipo_so: form.tipo_so || null,
    release: form.release || null,
    versao_java: form.versao_java || null,
    ambiente: form.ambiente || 'PROD',
    situacao: form.situacao || 'Ligado',
    criticidade: form.criticidade || null,
    observacao: form.observacao || null,
  };

  let hostId;
  if (editingId) {
    const { error } = await supabase.from('hosts').update(payload).eq('id', editingId);
    if (error) throw error;
    hostId = editingId;
    await supabase.from('host_tecnologias').delete().eq('host_id', hostId);
  } else {
    const { data, error } = await supabase.from('hosts').insert(payload).select('id').single();
    if (error) throw error;
    hostId = data.id;
  }

  for (const nome of form.tecnologias) {
    const tecId = await ensureLookup('tecnologias', 'nome', nome);
    if (tecId) {
      const { error } = await supabase.from('host_tecnologias')
        .insert({ host_id: hostId, tecnologia_id: tecId });
      if (error && error.code !== '23505') throw error;
    }
  }
  return hostId;
}

export async function deleteHost(id) {
  assertWritable();
  const { error } = await supabase.from('hosts').delete().eq('id', id);
  if (error) throw error;
}
