// ============================================================
// Dashboard — KPIs + gráficos (Chart.js via CDN global)
// ============================================================
import { countBy, soRisk, escapeHtml } from '../utils/helpers.js';

const PALETTE = ['#3FA110', '#146E37', '#7CC24E', '#FFCD00', '#A9D18E', '#57B52A',
  '#0E5B2D', '#C9E265', '#8FBF6F', '#D6B656'];

const charts = {};

function makeChart(id, type, labels, values, opts = {}) {
  const ctx = document.getElementById(id);
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: type === 'bar' ? '#3FA110' : PALETTE,
        borderColor: '#FFFFFF',
        borderWidth: type === 'doughnut' ? 2 : 0,
        borderRadius: type === 'bar' ? 5 : 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: opts.horizontal ? 'y' : 'x',
      plugins: {
        legend: {
          display: type === 'doughnut',
          position: 'right',
          labels: { boxWidth: 12, font: { size: 11, family: 'Inter' } },
        },
      },
      scales: type === 'doughnut' ? {} : {
        x: { ticks: { font: { size: 10, family: 'JetBrains Mono' }, autoSkip: true, maxRotation: 45 }, grid: { display: false } },
        y: { ticks: { font: { size: 10, family: 'JetBrains Mono' } }, grid: { color: '#E4EAE1' } },
      },
    },
  });
}

export function renderKpis(rows) {
  const total = rows.length;
  const ligados = rows.filter(r => r.situacao === 'Ligado').length;
  const eol = rows.filter(r => soRisk(r.versao_so) === 'eol').length;
  const warn = rows.filter(r => soRisk(r.versao_so) === 'warn').length;
  const dominios = new Set(rows.map(r => r.dominio).filter(Boolean)).size;
  const tecs = new Set(rows.flatMap(r => r.tecnologias ?? [])).size;

  const cards = [
    { num: total, label: 'Hosts', hint: 'filtro atual' },
    { num: ligados, label: 'Ligados', hint: `${total ? Math.round(ligados / total * 100) : 0}% do total` },
    { num: dominios, label: 'Domínios', hint: 'distintos' },
    { num: tecs, label: 'Tecnologias', hint: 'distintas' },
    { num: eol, label: 'SO fora de suporte', hint: 'RHEL ≤6 / CentOS', cls: eol ? 'alerta' : '' },
    { num: warn, label: 'RHEL 7 (ELS)', hint: 'extended até 2029', cls: warn ? 'atencao' : '' },
  ];

  document.getElementById('kpi-cards').innerHTML = cards.map(c => `
    <div class="kpi ${c.cls ?? ''}">
      <div class="kpi-num">${c.num}</div>
      <div class="kpi-label">${escapeHtml(c.label)}</div>
      <div class="kpi-hint">${escapeHtml(c.hint)}</div>
    </div>`).join('');
}

export function renderCharts(rows) {
  const top = (pairs, n) => {
    const t = pairs.slice(0, n);
    return { labels: t.map(p => p[0]), values: t.map(p => p[1]) };
  };

  const tec = top(countBy(rows, r => r.tecnologias ?? []), 10);
  makeChart('chart-tec', 'bar', tec.labels, tec.values, { horizontal: true });

  const so = top(countBy(rows, r => r.versao_so), 12);
  makeChart('chart-so', 'bar', so.labels, so.values);

  const fam = top(countBy(rows, r => r.tipo_so), 6);
  makeChart('chart-familia', 'doughnut', fam.labels, fam.values);

  const dom = top(countBy(rows, r => r.dominio), 10);
  makeChart('chart-dom', 'bar', dom.labels, dom.values, { horizontal: true });
}
