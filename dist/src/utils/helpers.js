// ============================================================
// Utilitários compartilhados
// ============================================================

export const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function clean(v) {
  if (v == null) return null;
  const s = String(v).replace(/\s+/g, ' ').trim();
  return s === '' ? null : s;
}

// Forma canônica conservadora. Útil para domínio e busca; não faz fuzzy match.
export function normText(v) {
  return String(v ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[_\-./\\|\s]+/g, ' ')
    .trim();
}

export function normDomain(v) {
  return normText(v).replace(/\s+/g, '');
}

const TEXT_FIELDS = [
  'hostname', 'time', 'dominio', 'negocio', 'vertical_negocio', 'versao_so',
  'tipo_so', 'release', 'versao_java', 'ambiente', 'situacao', 'criticidade',
  'observacao',
];

export function sanitizeHost(h) {
  const out = { ...h };
  for (const field of TEXT_FIELDS) out[field] = clean(out[field]);
  out.tecnologias = [...new Set((out.tecnologias ?? []).map(clean).filter(Boolean))];
  out.componentes = [...new Set((out.componentes ?? []).map(clean).filter(Boolean))];
  out.versoes_weblogic = [...new Set((out.versoes_weblogic ?? []).map(clean).filter(Boolean))];
  out._hay = buildHaystack(out);
  return out;
}

export function sanitizeComponent(c) {
  return {
    ...c,
    id: Number(c.id),
    dominio: clean(c.dominio ?? c.matched_domain ?? c.source_domain),
    source_domain: clean(c.source_domain),
    vertical_negocio: clean(c.vertical_negocio ?? c.vertical_business),
    nome: clean(c.nome ?? c.component_name),
    versao_weblogic: clean(c.versao_weblogic ?? c.weblogic_version),
    quantidade_hosts_declarada: c.quantidade_hosts_declarada ?? c.declared_host_count ?? null,
    source_endpoint: clean(c.source_endpoint),
    tecnologias: [...new Set((c.tecnologias ?? []).map(clean).filter(Boolean))],
    hosts_explicitos: [...new Set((c.hosts_explicitos ?? []).map(clean).filter(Boolean))],
    status: c.status ?? (c.dominio ? 'matched' : 'pending'),
  };
}

export function buildHaystack(item) {
  return normText([
    item.hostname, item.time, item.dominio, item.negocio, item.vertical_negocio,
    (item.tecnologias ?? []).join(' '), (item.componentes ?? []).join(' '),
    (item.versoes_weblogic ?? []).join(' '), item.nome, item.versao_weblogic,
    item.versao_so, item.tipo_so, item.release, item.versao_java,
    item.ambiente, item.situacao, item.criticidade, item.observacao,
  ].filter(Boolean).join(' | '));
}

export function searchRows(rows, query) {
  const q = normText(query);
  if (!q) return rows;
  const exact = rows.filter(row => (row._hay ?? buildHaystack(row)).includes(q));
  if (exact.length) return exact;
  const tokens = q.split(' ').filter(Boolean);
  return rows.filter(row => {
    const hay = row._hay ?? buildHaystack(row);
    return tokens.every(token => token.length >= 2
      ? hay.includes(token)
      : new RegExp(`(^| )${token}( |$)`).test(hay));
  });
}

export function enrichHosts(hosts, components) {
  const byDomain = new Map();
  for (const component of components) {
    const key = normDomain(component.dominio);
    if (!key || component.status !== 'matched') continue;
    if (!byDomain.has(key)) byDomain.set(key, []);
    byDomain.get(key).push(component);
  }
  return hosts.map(host => {
    const domainComponents = byDomain.get(normDomain(host.dominio)) ?? [];
    const vertical = host.vertical_negocio ?? domainComponents.find(c => c.vertical_negocio)?.vertical_negocio ?? null;
    const out = {
      ...host,
      vertical_negocio: vertical,
      componentes: domainComponents.map(c => c.nome).filter(Boolean),
      versoes_weblogic: [...new Set(domainComponents.map(c => c.versao_weblogic).filter(Boolean))],
      component_count: domainComponents.length,
    };
    out._hay = buildHaystack(out);
    return out;
  });
}

export function buildDomainTopology(hosts, components) {
  const domains = new Map();
  const ensure = (name) => {
    const key = normDomain(name) || `__sem_dominio__${name ?? ''}`;
    if (!domains.has(key)) {
      domains.set(key, {
        key,
        dominio: name || '(sem domínio)',
        vertical_negocio: null,
        hosts: [],
        components: [],
      });
    }
    return domains.get(key);
  };
  for (const host of hosts) {
    const domain = ensure(host.dominio);
    domain.hosts.push(host);
    domain.vertical_negocio ||= host.vertical_negocio;
  }
  for (const component of components) {
    const domain = ensure(component.dominio ?? component.source_domain);
    domain.components.push(component);
    domain.vertical_negocio ||= component.vertical_negocio;
  }
  return [...domains.values()]
    .map(domain => ({
      ...domain,
      technologies: [...new Set([
        ...domain.hosts.flatMap(h => h.tecnologias ?? []),
        ...domain.components.flatMap(c => c.tecnologias ?? []),
      ])].sort(),
      weblogicVersions: [...new Set(domain.components.map(c => c.versao_weblogic).filter(Boolean))].sort(),
      incomplete: !domain.vertical_negocio || !domain.hosts.length || !domain.components.length,
      status: domain.hosts.length && domain.components.length ? 'completo' : 'incompleto',
    }))
    .sort((a, b) => b.hosts.length - a.hosts.length || a.dominio.localeCompare(b.dominio, 'pt-BR'));
}

export function debounce(fn, ms = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

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
  const cols = [
    'hostname', 'time', 'dominio', 'vertical_negocio', 'negocio', 'componentes',
    'tecnologias', 'versoes_weblogic', 'versao_so', 'tipo_so', 'release',
    'versao_java', 'ambiente', 'situacao', 'criticidade', 'observacao',
  ];
  const esc = (value) => {
    if (Array.isArray(value)) value = value.join(' | ');
    value = String(value ?? '');
    return /[";\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  const lines = [cols.join(';'), ...rows.map(row => cols.map(col => esc(row[col])).join(';'))];
  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const anchor = document.createElement('a');
  anchor.href = URL.createObjectURL(blob);
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(anchor.href);
}

export function countBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const values = keyFn(row);
    for (const value of Array.isArray(values) ? values : [values]) {
      if (value == null || value === '') continue;
      map.set(value, (map.get(value) ?? 0) + 1);
    }
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0]), 'pt-BR'));
}

export const plural = (count, singular, pluralForm = `${singular}s`) =>
  `${count} ${count === 1 ? singular : pluralForm}`;
