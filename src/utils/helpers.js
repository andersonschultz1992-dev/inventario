// ============================================================
// Utilitários
// ============================================================

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// ---------- Normalização de dados ----------

// Sanitiza um valor de texto: trim + colapsa espaços internos. null se vazio.
export function clean(v) {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
}

// Sanitiza um host inteiro (em memória, sem alterar o banco)
const TEXT_FIELDS = ['hostname', 'time', 'dominio', 'negocio', 'versao_so', 'tipo_so',
  'release', 'versao_java', 'ambiente', 'situacao', 'criticidade', 'observacao'];

export function sanitizeHost(h) {
  const out = { ...h };
  for (const f of TEXT_FIELDS) out[f] = clean(out[f]);
  out.tecnologias = [...new Set((out.tecnologias ?? []).map(clean).filter(Boolean))];
  out._hay = buildHaystack(out);
  return out;
}

// ---------- Busca global ----------

// Forma canônica para busca: minúsculas, sem acentos, e _ - . / \ espaço
// viram um único espaço. Assim "bureau_domain" ≡ "bureau-domain" ≡ "BUREAU.DOMAIN".
export function normText(v) {
  return String(v ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-./\\|\s]+/g, ' ')
    .trim();
}

// Haystack: todos os campos pesquisáveis do host, já normalizados
export function buildHaystack(h) {
  return normText([
    h.hostname, h.time, h.dominio, h.negocio,
    (h.tecnologias ?? []).join(' '),
    h.versao_so, h.tipo_so, h.release, h.versao_java,
    h.ambiente, h.situacao, h.criticidade, h.observacao,
  ].filter(Boolean).join(' | '));
}

// Match de frase exata (normalizada) — "bureau_domain" ≡ "bureau domain"
export function matchesPhrase(host, query) {
  const q = normText(query);
  if (!q) return true;
  return (host._hay ?? buildHaystack(host)).includes(q);
}

// Match por tokens: todos precisam aparecer, em qualquer campo/ordem.
// Tokens de 1 caractere só casam como palavra inteira (evita que "5"
// case com qualquer dígito solto em hostnames).
export function matchesTokens(host, query) {
  const q = normText(query);
  if (!q) return true;
  const hay = host._hay ?? buildHaystack(host);
  return q.split(' ').every(tok =>
    tok.length >= 2 ? hay.includes(tok) : new RegExp(`(^| )${tok}( |$)`).test(hay));
}

// Busca em duas passadas sobre um conjunto de linhas:
// 1) frase exata — se encontrar algo, é o resultado (mais preciso);
// 2) senão, fallback por tokens (encontra termos em campos diferentes).
export function searchRows(rows, query) {
  const q = normText(query);
  if (!q) return rows;
  const exact = rows.filter(h => matchesPhrase(h, q));
  if (exact.length) return exact;
  return rows.filter(h => matchesTokens(h, q));
}

// Compatibilidade: match individual (frase OU tokens)
export function matchesSearch(host, query) {
  return matchesPhrase(host, query) || matchesTokens(host, query);
}

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
