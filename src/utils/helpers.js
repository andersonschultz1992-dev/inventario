// ============================================================
// Utilitários
// ============================================================

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

// Classificação de risco EOL por versão de SO (referência: aba EOL RHEL da planilha)
// RHEL 5/6 e CentOS: fora de suporte | RHEL 7: extended até 2029 | 8/9/Rocky: ok
export function soRisk(versaoSo) {
  if (!versaoSo) return 'neutral';
  const v = versaoSo.toLowerCase();
  if (v.startsWith('redhat-5') || v.startsWith('redhat-6') || v.startsWith('centos')) return 'eol';
  if (v.startsWith('redhat-7')) return 'warn';
  return 'ok';
}

export function situacaoBadge(s) {
  if (!s) return 'badge-neutral';
  if (s === 'Ligado') return 'badge-lig';
  if (s === 'Desligado') return 'badge-des';
  return 'badge-rem';
}

export function exportCsv(rows, filename = 'inventario-hosts.csv') {
  const cols = ['hostname', 'time', 'dominio', 'negocio', 'tecnologias', 'versao_so', 'tipo_so',
    'release', 'versao_java', 'ambiente', 'situacao', 'criticidade', 'observacao'];
  const esc = (v) => {
    if (Array.isArray(v)) v = v.join(' | ');
    v = String(v ?? '');
    return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  };
  const lines = [cols.join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))];
  // BOM para o Excel abrir com acentuação correta
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function countBy(rows, keyFn) {
  const map = new Map();
  for (const r of rows) {
    const keys = keyFn(r);
    for (const k of Array.isArray(keys) ? keys : [keys]) {
      if (k == null || k === '') continue;
      map.set(k, (map.get(k) ?? 0) + 1);
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}
