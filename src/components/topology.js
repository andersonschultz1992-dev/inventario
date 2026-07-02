import { buildDomainTopology, escapeHtml, normText, plural } from '../utils/helpers.js';
import { technologyIcon } from '../utils/technologyIcons.js';

const expandedDomains = new Set();
const expandedComponents = new Set();
let allDomains = [];
let onOpenExplore = null;

function componentKey(domain, component) {
  return `${domain.key}:${component.id ?? component.nome}`;
}

function hostList(domain, component) {
  const explicit = new Set(component.hosts_explicitos ?? []);
  const hosts = explicit.size
    ? domain.hosts.filter(host => explicit.has(host.hostname))
    : domain.hosts;
  const inherited = !explicit.size;
  return `
    <div class="component-hosts">
      <div class="component-hosts-title">
        ${inherited ? 'Hosts do domínio' : 'Hosts explicitamente associados'}
        <span class="info-dot" title="${inherited ? 'A planilha não possui hostname por componente. A lista abaixo pertence ao domínio e não cria vínculo técnico fictício.' : 'Associação explícita registrada no banco.'}">i</span>
      </div>
      ${hosts.length ? `<div class="host-chip-grid">${hosts.map(host => `
        <button class="host-chip" type="button" data-host="${escapeHtml(host.hostname)}">
          <span class="status-dot ${host.situacao === 'Ligado' ? 'online' : 'offline'}"></span>
          <span><strong>${escapeHtml(host.hostname)}</strong><small>${escapeHtml([host.ambiente, host.versao_so, host.versao_java].filter(Boolean).join(' · ') || 'Sem detalhes')}</small></span>
        </button>`).join('')}</div>` : '<p class="empty-inline">Nenhum host associado ao domínio no inventário atual.</p>'}
    </div>`;
}

function componentCard(domain, component) {
  const key = componentKey(domain, component);
  const expanded = expandedComponents.has(key);
  const technologies = component.tecnologias?.length ? component.tecnologias : [component.nome];
  return `
    <article class="component-card ${expanded ? 'expanded' : ''}" data-component-key="${escapeHtml(key)}">
      <button type="button" class="component-toggle" aria-expanded="${expanded}">
        ${technologyIcon(technologies[0], { label: technologies[0], size: 22 })}
        <span class="component-main">
          <strong>${escapeHtml(component.nome)}</strong>
          <small>${escapeHtml(component.versao_weblogic ? `WebLogic ${component.versao_weblogic}` : 'Versão WebLogic não informada')}</small>
        </span>
        <span class="component-metrics">
          <span class="mini-badge">${component.quantidade_hosts_declarada ?? domain.hosts.length} hosts</span>
          <span class="chevron">⌄</span>
        </span>
      </button>
      <div class="component-details ${expanded ? '' : 'hidden'}">
        <div class="detail-grid">
          <div><span>Tecnologia</span><strong>${escapeHtml((component.tecnologias ?? []).join(', ') || 'Detectada visualmente pelo nome')}</strong></div>
          <div><span>WebLogic</span><strong>${escapeHtml(component.versao_weblogic ?? 'Não informado')}</strong></div>
          <div><span>Origem</span><strong>${escapeHtml(component.origem ?? 'Planilha')}</strong></div>
          <div><span>Endpoint de referência</span><strong class="mono">${escapeHtml(component.source_endpoint ?? 'Não informado')}</strong></div>
        </div>
        ${hostList(domain, component)}
      </div>
    </article>`;
}

function domainCard(domain) {
  const expanded = expandedDomains.has(domain.key);
  const primaryTech = domain.technologies.slice(0, 3);
  return `
    <article class="domain-card ${expanded ? 'expanded' : ''} ${domain.incomplete ? 'incomplete' : ''}" data-domain-key="${escapeHtml(domain.key)}">
      <button class="domain-toggle" type="button" aria-expanded="${expanded}">
        <span class="domain-icon">${technologyIcon('weblogic server', { label: 'Domínio WebLogic', size: 28 })}</span>
        <span class="domain-identity">
          <span class="domain-name mono">${escapeHtml(domain.dominio)}</span>
          <span class="domain-vertical">${escapeHtml(domain.vertical_negocio ?? 'Vertical não informada')}</span>
        </span>
        <span class="domain-badges">
          <span class="metric-pill"><strong>${domain.components.length}</strong> componentes</span>
          <span class="metric-pill"><strong>${domain.hosts.length}</strong> hosts</span>
          <span class="status-pill ${domain.status}">${domain.status}</span>
          <span class="chevron">⌄</span>
        </span>
      </button>
      <div class="domain-preview">
        <div class="tech-stack">${primaryTech.map(tech => `<span>${technologyIcon(tech, { size: 16 })}${escapeHtml(tech)}</span>`).join('') || '<span>Sem tecnologia informada</span>'}</div>
        <button type="button" class="link-btn domain-explore" data-domain="${escapeHtml(domain.dominio)}">Abrir no inventário</button>
      </div>
      <div class="domain-details ${expanded ? '' : 'hidden'}">
        <div class="topology-line" aria-hidden="true"></div>
        <div class="domain-detail-summary">
          <div><span>Versões WebLogic</span><strong>${escapeHtml(domain.weblogicVersions.join(', ') || 'Não informado')}</strong></div>
          <div><span>Tecnologias</span><strong>${domain.technologies.length}</strong></div>
          <div><span>Servidores</span><strong>${domain.hosts.length}</strong></div>
          <div><span>Qualidade</span><strong>${domain.incomplete ? 'Requer revisão' : 'Relacionamento completo'}</strong></div>
        </div>
        <div class="components-list">
          ${domain.components.length ? domain.components.map(component => componentCard(domain, component)).join('') : '<div class="empty-topology">Nenhum componente associado a este domínio.</div>'}
        </div>
      </div>
    </article>`;
}

function bindInteractions() {
  document.querySelectorAll('.domain-toggle').forEach(button => button.addEventListener('click', () => {
    const key = button.closest('.domain-card').dataset.domainKey;
    expandedDomains.has(key) ? expandedDomains.delete(key) : expandedDomains.add(key);
    renderCurrent();
  }));
  document.querySelectorAll('.component-toggle').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    const key = button.closest('.component-card').dataset.componentKey;
    expandedComponents.has(key) ? expandedComponents.delete(key) : expandedComponents.add(key);
    renderCurrent();
  }));
  document.querySelectorAll('.domain-explore').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    onOpenExplore?.({ dominio: button.dataset.domain });
  }));
  document.querySelectorAll('.host-chip').forEach(button => button.addEventListener('click', () => {
    onOpenExplore?.({ busca: button.dataset.host });
  }));
}

function renderCurrent() {
  const query = normText(document.getElementById('topology-search')?.value);
  const onlyIncomplete = document.getElementById('topology-incomplete')?.checked;
  const filtered = allDomains.filter(domain => {
    if (onlyIncomplete && !domain.incomplete) return false;
    if (!query) return true;
    const haystack = normText([
      domain.dominio, domain.vertical_negocio,
      domain.technologies.join(' '), domain.weblogicVersions.join(' '),
      domain.components.map(component => component.nome).join(' '),
      domain.hosts.map(host => host.hostname).join(' '),
    ].join(' '));
    return haystack.includes(query);
  });
  const container = document.getElementById('topology-list');
  container.innerHTML = filtered.length
    ? filtered.map(domainCard).join('')
    : '<div class="panel empty-state"><div class="empty-icon">⌁</div><p><strong>Nenhum domínio encontrado.</strong></p><p class="muted">Ajuste a busca ou remova o filtro de incompletos.</p></div>';
  document.getElementById('topology-count').textContent = `${plural(filtered.length, 'domínio')} · ${filtered.reduce((sum, domain) => sum + domain.components.length, 0)} componentes`;
  bindInteractions();
}

export function initTopology() {
  document.getElementById('topology-search').addEventListener('input', renderCurrent);
  document.getElementById('topology-incomplete').addEventListener('change', renderCurrent);
  document.getElementById('topology-expand-all').addEventListener('click', () => {
    const expand = expandedDomains.size !== allDomains.length;
    expandedDomains.clear();
    if (expand) allDomains.forEach(domain => expandedDomains.add(domain.key));
    renderCurrent();
  });
}

export function renderTopology(hosts, components, openExplore) {
  onOpenExplore = openExplore;
  allDomains = buildDomainTopology(hosts, components);
  renderCurrent();
}
