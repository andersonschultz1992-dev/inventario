// ============================================================
// App — orquestrador principal
// ============================================================
import * as api from './services/api.js';
import * as auth from './services/auth.js';
import { initFilters, applyFilters, populateFilters, renderSummary, clearAll } from './components/filters.js';
import { renderKpis, renderCharts } from './components/dashboard.js';
import { initTable, renderTable, resetPage } from './components/table.js';
import { initHostForm, openHostForm, populateFormLookups } from './components/hostForm.js';
import { exportCsv } from './utils/helpers.js';
import { exportPng, exportPdf, exportFilename } from './components/export.js';
import { initBackground } from './components/background.js';

let hosts = [];
let lookups = null;

const $ = (id) => document.getElementById(id);

function toast(msg, cls = 'ok') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast ${cls}`;
  setTimeout(() => t.classList.add('hidden'), 3200);
}

function currentRows() { return applyFilters(hosts); }

function renderAll({ repopulate = false } = {}) {
  const rows = currentRows();
  renderKpis(rows);
  renderCharts(rows);
  renderTable(rows, { editable: auth.canEdit(), deletable: auth.canDelete() });
  renderSummary(rows.length, hosts.length);
  if (repopulate) populateFilters(hosts);
}

async function reloadData() {
  hosts = await api.fetchHosts();
  lookups = await api.fetchLookups();
  populateFormLookups(lookups, hosts);
  renderAll({ repopulate: true });
}

function setupModeBadge() {
  const badge = $('mode-badge');
  if (api.MODE === 'demo') {
    badge.textContent = 'MODO DEMO · somente leitura';
    badge.classList.add('demo');
    badge.title = 'Configure src/config/supabase.js para habilitar edição';
    $('btn-auth').classList.add('hidden');
  } else {
    badge.textContent = 'SUPABASE';
  }
}

function setupAuthUi() {
  auth.onAuthChange((user, role) => {
    const btnAuth = $('btn-auth');
    if (user) {
      btnAuth.textContent = `Sair (${role})`;
      btnAuth.onclick = async () => { await auth.signOut(); toast('Sessão encerrada.'); };
      $('btn-add').classList.toggle('hidden', !auth.canEdit());
    } else {
      btnAuth.textContent = 'Entrar';
      btnAuth.onclick = () => $('modal-auth').classList.remove('hidden');
      $('btn-add').classList.add('hidden');
    }
    renderAll();
  });

  $('btn-auth').onclick = () => $('modal-auth').classList.remove('hidden');

  $('btn-login').addEventListener('click', async () => {
    try {
      await auth.signIn($('auth-email').value.trim(), $('auth-pass').value);
      $('modal-auth').classList.add('hidden');
      toast('Login efetuado.');
    } catch (err) {
      $('auth-error').textContent = 'Falha no login: ' + err.message;
      $('auth-error').classList.remove('hidden');
    }
  });

  $('btn-signup').addEventListener('click', async () => {
    try {
      await auth.signUp($('auth-email').value.trim(), $('auth-pass').value);
      $('auth-error').classList.add('hidden');
      toast('Conta criada. Confirme o e-mail e peça a um admin para liberar o papel de editor.', 'ok');
    } catch (err) {
      $('auth-error').textContent = 'Falha no cadastro: ' + err.message;
      $('auth-error').classList.remove('hidden');
    }
  });
}

function setupModals() {
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', (e) => {
      if (e.target === m || e.target.hasAttribute('data-close')) m.classList.add('hidden');
    });
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') document.querySelectorAll('.modal').forEach(m => m.classList.add('hidden'));
  });
}

async function handleDelete(host) {
  if (!confirm(`Remover o host "${host.hostname}" do inventário? Esta ação não pode ser desfeita.`)) return;
  try {
    await api.deleteHost(host.id);
    toast(`Host ${host.hostname} removido.`);
    await reloadData();
  } catch (err) {
    toast('Erro ao remover: ' + err.message, 'err');
  }
}

async function main() {
  initBackground();
  setupModeBadge();
  setupModals();
  setupAuthUi();   // bugfix v2: estava definido mas nunca era chamado

  await api.init();
  await auth.initAuth();

  initFilters(() => { resetPage(); renderAll(); });
  initTable({ onEdit: (h) => openHostForm(h), onDelete: handleDelete });
  initHostForm(async (action) => {
    toast(`Host ${action} com sucesso.`);
    await reloadData();
  });

  document.addEventListener('table:refresh', () => renderAll());
  document.addEventListener('filters:clear', () => clearAll());
  $('btn-add').addEventListener('click', () => openHostForm());

  // CSV — respeita busca + filtros; nome com data/hora e filtros ativos
  $('btn-export').addEventListener('click', () => {
    const rows = currentRows();
    if (!rows.length) return toast('Nada para exportar com os filtros atuais.', 'err');
    exportCsv(rows, exportFilename('csv'));
    toast(`${rows.length} host(s) exportado(s) em CSV.`);
  });

  // Print — PNG/PDF da visão atual (todos os registros filtrados)
  $('btn-print').addEventListener('click', () => {
    if (!currentRows().length) return toast('Nada para exportar com os filtros atuais.', 'err');
    $('modal-print').classList.remove('hidden');
  });

  const runExport = async (fn, label) => {
    const rows = currentRows();
    const btns = [$('btn-print-png'), $('btn-print-pdf')];
    btns.forEach(b => b.disabled = true);
    $('print-status').classList.remove('hidden');
    try {
      await fn(rows);
      $('modal-print').classList.add('hidden');
      toast(`${label} gerado com ${rows.length} host(s).`);
    } catch (err) {
      console.error(err);
      toast('Erro ao gerar ' + label + ': ' + err.message, 'err');
    } finally {
      btns.forEach(b => b.disabled = false);
      $('print-status').classList.add('hidden');
    }
  };
  $('btn-print-png').addEventListener('click', () => runExport(exportPng, 'PNG'));
  $('btn-print-pdf').addEventListener('click', () => runExport(exportPdf, 'PDF'));

  await reloadData();
}

main().catch(err => {
  console.error(err);
  document.getElementById('kpi-cards').innerHTML =
    `<div class="panel" style="grid-column:1/-1;color:var(--vermelho)">Erro ao inicializar: ${err.message}</div>`;
});
