// ============================================================
// Filtros — busca textual + selects dependentes dos dados
// ============================================================
import { debounce, escapeHtml, countBy } from '../utils/helpers.js';

const state = { busca: '', time: '', tec: '', dominio: '', so: '', familia: '', java: '', situacao: '' };

export function getFilterState() { return { ...state }; }

export function applyFilters(rows) {
  return rows.filter(r => {
    if (state.busca && !r.hostname.toLowerCase().includes(state.busca.toLowerCase())) return false;
    if (state.time && r.time !== state.time) return false;
    if (state.tec && !(r.tecnologias ?? []).includes(state.tec)) return false;
    if (state.dominio && r.dominio !== state.dominio) return false;
    if (state.so && r.versao_so !== state.so) return false;
    if (state.familia && r.tipo_so !== state.familia) return false;
    if (state.java && (r.versao_java ?? '') !== state.java) return false;
    if (state.situacao && (r.situacao ?? '') !== state.situacao) return false;
    return true;
  });
}

function fillSelect(id, values, current) {
  const sel = document.getElementById(id);
  const first = sel.querySelector('option').outerHTML;
  sel.innerHTML = first + values.map(v =>
    `<option value="${escapeHtml(v)}" ${v === current ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('');
}

export function populateFilters(rows) {
  const uniq = (fn) => countBy(rows, fn).map(p => p[0]).sort((a, b) => String(a).localeCompare(String(b)));
  fillSelect('f-time', uniq(r => r.time), state.time);
  fillSelect('f-tec', uniq(r => r.tecnologias ?? []), state.tec);
  fillSelect('f-dominio', uniq(r => r.dominio), state.dominio);
  fillSelect('f-so', uniq(r => r.versao_so), state.so);
  fillSelect('f-familia', uniq(r => r.tipo_so), state.familia);
  fillSelect('f-java', uniq(r => r.versao_java), state.java);
  fillSelect('f-situacao', uniq(r => r.situacao), state.situacao);
}

function renderSummary() {
  const labels = {
    busca: 'busca', time: 'time', tec: 'tecnologia', dominio: 'domínio',
    so: 'SO', familia: 'família', java: 'Java', situacao: 'situação',
  };
  const chips = Object.entries(state)
    .filter(([, v]) => v)
    .map(([k, v]) => `<span class="chip">${labels[k]}: ${escapeHtml(v)}</span>`);
  document.getElementById('filter-summary').innerHTML =
    chips.length ? 'Filtros ativos: ' + chips.join(' ') : '';
}

export function initFilters(onChange) {
  const trigger = () => { renderSummary(); onChange(); };

  document.getElementById('f-busca').addEventListener('input',
    debounce((e) => { state.busca = e.target.value.trim(); trigger(); }, 200));

  const bind = (id, key) =>
    document.getElementById(id).addEventListener('change', (e) => { state[key] = e.target.value; trigger(); });

  bind('f-time', 'time'); bind('f-tec', 'tec'); bind('f-dominio', 'dominio');
  bind('f-so', 'so'); bind('f-familia', 'familia'); bind('f-java', 'java');
  bind('f-situacao', 'situacao');

  document.getElementById('btn-limpar').addEventListener('click', () => {
    Object.keys(state).forEach(k => state[k] = '');
    document.getElementById('f-busca').value = '';
    document.querySelectorAll('.filters-row select').forEach(s => s.value = '');
    trigger();
  });
}
