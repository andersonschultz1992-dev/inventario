// ============================================================
// Tabela de hosts — ordenação, paginação, ações por linha
// ============================================================
import { escapeHtml, soRisk, situacaoBadge } from '../utils/helpers.js';

const PAGE_SIZE = 25;
let page = 1;
let sortKey = 'hostname';
let sortDesc = false;
let onEditCb = null;
let onDeleteCb = null;

export function initTable({ onEdit, onDelete }) {
  onEditCb = onEdit;
  onDeleteCb = onDelete;

  document.querySelectorAll('#hosts-table thead th[data-sort]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (sortKey === key) sortDesc = !sortDesc;
      else { sortKey = key; sortDesc = false; }
      document.dispatchEvent(new CustomEvent('table:refresh'));
    });
  });
  document.getElementById('pg-prev').addEventListener('click', () => { page--; document.dispatchEvent(new CustomEvent('table:refresh')); });
  document.getElementById('pg-next').addEventListener('click', () => { page++; document.dispatchEvent(new CustomEvent('table:refresh')); });
}

export function resetPage() { page = 1; }

export function renderTable(rows, { editable, deletable }) {
  const sorted = [...rows].sort((a, b) => {
    const va = (a[sortKey] ?? '').toString().toLowerCase();
    const vb = (b[sortKey] ?? '').toString().toLowerCase();
    return (va < vb ? -1 : va > vb ? 1 : 0) * (sortDesc ? -1 : 1);
  });

  const pages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  page = Math.min(Math.max(1, page), pages);
  const slice = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  document.querySelectorAll('#hosts-table thead th[data-sort]').forEach(th => {
    th.classList.toggle('sorted', th.dataset.sort === sortKey);
    th.classList.toggle('desc', th.dataset.sort === sortKey && sortDesc);
  });

  const soBadge = (v) => {
    if (!v) return '<span class="badge badge-neutral">—</span>';
    const cls = { ok: 'badge-so-ok', warn: 'badge-so-warn', eol: 'badge-so-eol', neutral: 'badge-neutral' }[soRisk(v)];
    return `<span class="badge ${cls}" title="${soRisk(v) === 'eol' ? 'Fora de suporte' : soRisk(v) === 'warn' ? 'Extended Life-cycle Support' : 'Suportado'}">${escapeHtml(v)}</span>`;
  };

  // data-label alimenta o modo "cards" no mobile (CSS ::before)
  document.getElementById('hosts-tbody').innerHTML = slice.map(r => `
    <tr data-id="${r.id}">
      <td class="mono cell-host"><strong>${escapeHtml(r.hostname)}</strong></td>
      <td data-label="Time"><span class="badge badge-neutral">${escapeHtml(r.time ?? '—')}</span></td>
      <td data-label="Domínio" class="mono">${escapeHtml(r.dominio ?? '—')}</td>
      <td data-label="Tecnologias">${(r.tecnologias ?? []).map(t => `<span class="tec-tag">${escapeHtml(t)}</span>`).join('') || '—'}</td>
      <td data-label="SO">${soBadge(r.versao_so)}</td>
      <td data-label="Release" class="mono">${escapeHtml(r.release ?? '—')}</td>
      <td data-label="Java" class="mono">${escapeHtml(r.versao_java ?? '—')}</td>
      <td data-label="Situação"><span class="badge ${situacaoBadge(r.situacao)}">${escapeHtml(r.situacao ?? '—')}</span></td>
      <td class="cell-actions">
        <div class="row-actions">
          ${editable ? `<button class="icon-btn" data-act="edit" title="Editar">✎</button>` : ''}
          ${deletable ? `<button class="icon-btn danger" data-act="del" title="Remover">🗑</button>` : ''}
        </div>
      </td>
    </tr>`).join('');

  document.getElementById('hosts-tbody').querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-act]');
      const id = Number(b.closest('tr').dataset.id);
      const host = rows.find(r => r.id === id);
      if (b.dataset.act === 'edit') onEditCb?.(host);
      else onDeleteCb?.(host);
    });
  });

  document.getElementById('table-count').textContent =
    `${sorted.length} host${sorted.length === 1 ? '' : 's'}`;
  document.getElementById('pg-info').textContent = `${page} / ${pages}`;
  document.getElementById('pg-prev').disabled = page <= 1;
  document.getElementById('pg-next').disabled = page >= pages;
}
