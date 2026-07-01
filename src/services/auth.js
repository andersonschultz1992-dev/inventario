// ============================================================
// Autenticação — Supabase Auth (e-mail/senha)
// No modo demo não há login: app fica somente leitura.
// ============================================================
import { MODE, getClient } from './api.js';

let currentUser = null;
let currentRole = 'viewer';
const listeners = [];

export function onAuthChange(fn) { listeners.push(fn); }
function notify() { listeners.forEach(fn => fn(currentUser, currentRole)); }

export function getUser() { return currentUser; }
export function canEdit() { return MODE === 'supabase' && currentUser && ['editor', 'admin'].includes(currentRole); }
export function canDelete() { return MODE === 'supabase' && currentUser && currentRole === 'admin'; }

async function loadRole() {
  if (!currentUser) { currentRole = 'viewer'; return; }
  const { data } = await getClient().from('profiles').select('role').eq('id', currentUser.id).maybeSingle();
  currentRole = data?.role ?? 'viewer';
}

export async function initAuth() {
  if (MODE !== 'supabase') return;
  const sb = getClient();
  const { data: { session } } = await sb.auth.getSession();
  currentUser = session?.user ?? null;
  await loadRole();
  notify();
  sb.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user ?? null;
    await loadRole();
    notify();
  });
}

export async function signIn(email, password) {
  const { error } = await getClient().auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUp(email, password) {
  const { error } = await getClient().auth.signUp({ email, password });
  if (error) throw error;
}

export async function signOut() {
  await getClient().auth.signOut();
}
