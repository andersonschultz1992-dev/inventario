// ============================================================
// Filtros — busca global normalizada + selects combinantes
// Busca cobre: hostname, domínio, tecnologia, SO, versão SO,
// tipo SO, Java, ambiente, situação, negócio e observação.
// Tolerante a caixa, acentos, espaços e separadores (_ - . /).
// ============================================================
import { debounce, escapeHtml, countBy, searchRows } from '../utils/helpers.js';

// Sentinela para filtrar registros com o campo vazio/não informado
export const VAZIO = '__vazio__';

const state = {
  busca: '', time: '', tec: '', dominio: '', so: '',
  familia: '', java: '', ambiente: '', situacao: '',
};

export function getFilterState() { return { ...state }; }
export function hasActiveFilters() { return Object.values(state).some(Boolean); }

// Descrição humana dos filtros ativos (usada no print e nos nomes de arquivo)
export function describeFilters() {
  const labels = {
    busca: 'busca', time: 'time', tec: 'tecnologia', dominio: 'domínio',
    so: 'versão SO', familia: 'família SO', java: 'Java',
    ambiente: 'ambiente', situacao: 'situação',
  };
  return Object.entries(state)
    .filter(([, v]) => v)
    .map(([k, v]) => `${labels[k]}: ${v === VAZIO ? '(não informado)' : v}`);
}

function fieldMatch(value, filter) {
  if (!filter) return true;
  if (filter === VAZIO) return value == null || value === '';
  return (value ?? '') === filter;
}

export function applyFilters(rows) {
  // 1) filtros estruturados (combináveis)
  const base = rows.filter(r => {
    if (!fieldMatch(r.time, state.time)) return false;
    if (state.tec) {
      if (state.tec === VAZIO) { if ((r.tecnologias ?? []).length) return false; }
      else if (!(r.tecnologias ?? []).includes(state.tec)) return false;
    }
    if (!fieldMatch(r.dominio, state.dominio)) return false;
    if (!fieldMatch(r.versao_so, state.so)) return false;
    if (!fieldMatch(r.tipo_so, state.familia)) return false;
    if (!fieldMatch(r.versao_java, state.java)) return false;
    if (!fieldMatch(r.ambiente, state.ambiente)) return false;
    if (!fieldMatch(r.situacao, state.situacao)) return false;
    return true;
  });
  // 2) busca global em duas passadas sobre o resultado dos filtros
  return searchRows(base, state.busca);
}

function fillSelect(id, values, current, hasEmpty) {
  const sel = document.getElementById(id);
  if (!sel) return;
  const first = sel.querySelector('option').outerHTML;
  const opts = values.map(v =>
    `<option value="${escapeHtml(v)}" ${v === current ? 'selected' : ''}>${escapeHtml(v)}</option>`);
  if (hasEmpty) {
    opts.push(`<option value="${VAZIO}" ${current === VAZIO ? 'selected' : ''}>(não informado)</option>`);
  }
  sel.innerHTML = first + opts.join('');
}

export function populateFilters(rows) {
  const uniq = (fn) => countBy(rows, fn).map(p => p[0])
    .sort((a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true }));
  const anyEmpty = (fn) => rows.some(r => { const v = fn(r); return v == null || v === '' || (Array.isArray(v) && !v.length); });

  fillSelect('f-time',     uniq(r => r.time),               state.time,     anyEmpty(r => r.time));
  fillSelect('f-tec',      uniq(r => r.tecnologias ?? []),  state.tec,      anyEmpty(r => r.tecnologias));
  fillSelect('f-dominio',  uniq(r => r.dominio),            state.dominio,  anyEmpty(r => r.dominio));
  fillSelect('f-so',       uniq(r => r.versao_so),          state.so,       anyEmpty(r => r.versao_so));
  fillSelect('f-familia',  uniq(r => r.tipo_so),            state.familia,  anyEmpty(r => r.tipo_so));
  fillSelect('f-java',     uniq(r => r.versao_java),        state.java,     anyEmpty(r => r.versao_java));
  fillSelect('f-ambiente', uniq(r => r.ambiente),           state.ambiente, anyEmpty(r => r.ambiente));
  fillSelect('f-situacao', uniq(r => r.situacao),           state.situacao, anyEmpty(r => r.situacao));
}

export function renderSummary(filteredCount, totalCount) {
  const chips = describeFilters().map(d => `<span class="chip">${escapeHtml(d)}</span>`);
  const count = `<strong>${filteredCount}</strong> de ${totalCount} hosts`;
  document.getElementById('filter-summary').innerHTML =
    chips.length
      ? `${count} · filtros ativos: ${chips.join(' ')} <button id="chip-limpar" class="chip chip-btn" type="button">✕ limpar tudo</button>`
      : count;
  document.getElementById('chip-limpar')?.addEventListener('click', clearAll);
}

let onChangeCb = null;

export function clearAll() {
  Object.keys(state).forEach(k => state[k] = '');
  document.getElementById('f-busca').value = '';
  document.querySelectorAll('.filters-row select').forEach(s => s.value = '');
  onChangeCb?.();
}

export function initFilters(onChange) {
  onChangeCb = onChange;

  document.getElementById('f-busca').addEventListener('input',
    debounce((e) => { state.busca = e.target.value.trim(); onChange(); }, 200));

  const bind = (id, key) =>
    document.getElementById(id)?.addEventListener('change', (e) => { state[key] = e.target.value; onChange(); });

  bind('f-time', 'time'); bind('f-tec', 'tec'); bind('f-dominio', 'dominio');
  bind('f-so', 'so'); bind('f-familia', 'familia'); bind('f-java', 'java');
  bind('f-ambiente', 'ambiente'); bind('f-situacao', 'situacao');

  document.getElementById('btn-limpar').addEventListener('click', clearAll);
}
