import { countBy, escapeHtml, normDomain, soRisk } from '../utils/helpers.js';

const PALETTE = ['#3FA110', '#146E37', '#7CC24E', '#FFCD00', '#A9D18E', '#57B52A', '#0E5B2D', '#C9E265', '#8FBF6F', '#D6B656'];
const charts = {};
let navigationCallback = null;

const TITLES = {
  'chart-vertical': 'Domínios por vertical de negócio',
  'chart-components-domain': 'Componentes por domínio',
  'chart-hosts-domain': 'Hosts por domínio',
  'chart-tech': 'Tecnologias mais utilizadas',
  'chart-wls': 'Distribuição das versões WebLogic',
  'chart-java': 'Distribuição das versões Java',
  'chart-os': 'Distribuição das versões de sistema operacional',
  'chart-family': 'Famílias de sistema operacional',
};

export function getChartImages() {
  return Object.entries(charts)
    .filter(([, chart]) => chart)
    .map(([id, chart]) => ({ title: TITLES[id] ?? id, dataUrl: chart.toBase64Image('image/png', 1) }));
}

function top(pairs, limit) {
  const values = pairs.slice(0, limit);
  return { labels: values.map(pair => pair[0]), values: values.map(pair => pair[1]) };
}

function chartClick(filterKey, labels) {
  if (!filterKey) return undefined;
  return (_event, elements) => {
    const index = elements?.[0]?.index;
    if (index == null) return;
    const label = labels[index];
    navigationCallback?.({ [filterKey]: label === '(não informado)' ? '__vazio__' : label });
  };
}

function makeChart(id, type, labels, values, options = {}) {
  const canvas = document.getElementById(id);
  if (!canvas || !window.Chart) return;
  charts[id]?.destroy();
  const mobile = window.matchMedia('(max-width: 640px)').matches;
  charts[id] = new Chart(canvas, {
    type,
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: type === 'bar' ? '#3FA110' : PALETTE,
        borderColor: '#FFFFFF',
        borderWidth: type === 'doughnut' ? 2 : 0,
        borderRadius: type === 'bar' ? 7 : 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: options.horizontal ? 'y' : 'x',
      onClick: chartClick(options.filterKey, labels),
      onHover: (event, elements) => { const target = event.native?.target; if (target) target.style.cursor = elements.length ? 'pointer' : 'default'; },
      plugins: {
        legend: {
          display: type === 'doughnut',
          position: mobile ? 'bottom' : 'right',
          labels: { boxWidth: 11, usePointStyle: true, font: { size: 11, family: 'Inter' } },
        },
        tooltip: {
          displayColors: false,
          callbacks: { label: context => `${context.label}: ${context.formattedValue}` },
        },
      },
      scales: type === 'doughnut' ? {} : {
        x: {
          beginAtZero: true,
          ticks: { precision: 0, font: { size: mobile ? 9 : 10, family: 'JetBrains Mono' }, maxRotation: mobile ? 55 : 30 },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
            font: { size: mobile ? 9 : 10, family: 'JetBrains Mono' },
            callback: options.horizontal ? function (value) {
              const label = this.getLabelForValue(value);
              const max = mobile ? 18 : 28;
              return label.length > max ? `${label.slice(0, max - 1)}…` : label;
            } : undefined,
          },
          grid: { color: 'rgba(20,110,55,.08)' },
        },
      },
    },
  });
}

function domainStats(hosts, components) {
  const map = new Map();
  const ensure = name => {
    const key = normDomain(name);
    if (!map.has(key)) map.set(key, { name: name || '(sem domínio)', hosts: 0, components: 0, vertical: null });
    return map.get(key);
  };
  hosts.forEach(host => { const item = ensure(host.dominio); item.hosts += 1; item.vertical ||= host.vertical_negocio; });
  components.filter(component => component.status === 'matched').forEach(component => {
    const item = ensure(component.dominio);
    item.components += 1;
    item.vertical ||= component.vertical_negocio;
  });
  return [...map.values()];
}

export function renderKpis(hosts, components, pendingCount = 0) {
  const matchedComponents = components.filter(component => component.status === 'matched');
  const domains = new Set(hosts.map(host => normDomain(host.dominio)).filter(Boolean)).size;
  const technologies = new Set(hosts.flatMap(host => host.tecnologias ?? [])).size;
  const incompleteHosts = hosts.filter(host => !host.dominio || !host.vertical_negocio || !(host.componentes ?? []).length).length;
  const incompletePercent = hosts.length ? Math.round((incompleteHosts / hosts.length) * 100) : 0;
  const cards = [
    { value: hosts.length, label: 'Hosts', hint: 'inventário atual', filter: {} },
    { value: domains, label: 'Domínios', hint: 'distintos', route: 'topologia' },
    { value: matchedComponents.length, label: 'Componentes', hint: 'associados', route: 'topologia' },
    { value: technologies, label: 'Tecnologias', hint: 'distintas' },
    { value: pendingCount, label: 'Pendências', hint: 'associação manual', cls: pendingCount ? 'kpi-warning' : '', route: 'admin' },
    { value: `${incompletePercent}%`, label: 'Dados incompletos', hint: `${incompleteHosts} hosts`, cls: incompletePercent ? 'kpi-attention' : '' },
  ];
  document.getElementById('kpi-cards').innerHTML = cards.map((card, index) => `
    <button class="kpi ${card.cls ?? ''}" type="button" data-kpi="${index}">
      <span class="kpi-num">${escapeHtml(card.value)}</span>
      <span class="kpi-label">${escapeHtml(card.label)}</span>
      <span class="kpi-hint">${escapeHtml(card.hint)}</span>
    </button>`).join('');
  document.querySelectorAll('[data-kpi]').forEach(button => button.addEventListener('click', () => {
    const card = cards[Number(button.dataset.kpi)];
    navigationCallback?.(card.filter ?? {}, card.route ?? 'explorar');
  }));
}

export function renderCharts(hosts, components) {
  const domains = domainStats(hosts, components);
  const verticalPairs = countBy(domains, domain => domain.vertical || '(não informado)');
  const componentPairs = domains.map(domain => [domain.name, domain.components]).sort((a, b) => b[1] - a[1]);
  const hostPairs = domains.map(domain => [domain.name, domain.hosts]).sort((a, b) => b[1] - a[1]);

  const vertical = top(verticalPairs, 10);
  makeChart('chart-vertical', 'doughnut', vertical.labels, vertical.values, { filterKey: 'vertical' });
  const componentDomain = top(componentPairs, 12);
  makeChart('chart-components-domain', 'bar', componentDomain.labels, componentDomain.values, { horizontal: true, filterKey: 'dominio' });
  const hostDomain = top(hostPairs, 12);
  makeChart('chart-hosts-domain', 'bar', hostDomain.labels, hostDomain.values, { horizontal: true, filterKey: 'dominio' });

  const tech = top(countBy(hosts, host => host.tecnologias ?? []), 12);
  makeChart('chart-tech', 'bar', tech.labels, tech.values, { horizontal: true, filterKey: 'tecnologia' });
  const wls = top(countBy(components.filter(component => component.status === 'matched'), component => component.versao_weblogic), 8);
  makeChart('chart-wls', 'doughnut', wls.labels, wls.values, { filterKey: 'weblogic' });
  const java = top(countBy(hosts, host => host.versao_java), 10);
  makeChart('chart-java', 'bar', java.labels, java.values, { filterKey: 'java' });
  const os = top(countBy(hosts, host => host.versao_so), 12);
  makeChart('chart-os', 'bar', os.labels, os.values, { filterKey: 'so' });
  const family = top(countBy(hosts, host => host.tipo_so), 8);
  makeChart('chart-family', 'doughnut', family.labels, family.values, { filterKey: 'familia' });
}

export function renderDashboard(hosts, components, pendingCount, onNavigate) {
  navigationCallback = onNavigate;
  renderKpis(hosts, components, pendingCount);
  renderCharts(hosts, components);

  const eol = hosts.filter(host => soRisk(host.versao_so) === 'eol').length;
  const summary = document.getElementById('dashboard-summary');
  summary.innerHTML = `<strong>${hosts.length}</strong> hosts monitorados, <strong>${components.filter(c => c.status === 'matched').length}</strong> componentes e <strong>${eol}</strong> hosts com SO fora de suporte.`;
}
