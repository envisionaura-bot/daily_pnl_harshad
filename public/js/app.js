/* =====================================================
   TradeDesk — Main Application Logic
   ===================================================== */

// ---- State ----
let allData = { strategies: [], entries: [] };
let activeStrategies = new Set(['all']); // 'all' means everything selected
let fromDate = null;
let toDate = null;
let calYear = 2025;   // will be set to last data month on load
let calMonth = 0;

// ---- Charts registry ----
const charts = {};

// ---- Utility ----
const fmt = n => new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.abs(n));
const fmtSigned = n => (n >= 0 ? '+₹' : '-₹') + fmt(n);
const fmtPct = n => (n >= 0 ? '+' : '') + Number(n).toFixed(2) + '%';

function getFilteredEntries() {
  let entries = [...allData.entries];
  if (!activeStrategies.has('all')) {
    entries = entries.filter(e => activeStrategies.has(e.strategy));
  }
  if (fromDate) entries = entries.filter(e => e.date >= fromDate);
  if (toDate) entries = entries.filter(e => e.date <= toDate);
  return entries;
}

function getStrategyColor(id) {
  const s = allData.strategies.find(s => s.id === id);
  return s ? s.color : '#666';
}

function getStrategyName(id) {
  const s = allData.strategies.find(s => s.id === id);
  return s ? s.name : id;
}

function destroyChart(key) {
  if (charts[key]) {
    charts[key].destroy();
    delete charts[key];
  }
}

// ---- JSONBin Cloud Data Layer ----
const JSONBIN_URL = 'https://api.jsonbin.io/v3/b/6a222874f5f4af5e29bb67b6';
const JSONBIN_KEY = '$2a$10$8zxGhy.NKKIVxn8dMu5uJedizX1xgyjDQkhcO0Dsdrhawyabxpmr6';

async function getData() {
  try {
    const res = await fetch(JSONBIN_URL + '/latest', {
      headers: { 'X-Access-Key': JSONBIN_KEY }
    });
    const json = await res.json();
    return json.record || { strategies: [], entries: [] };
  } catch {
    return { strategies: [], entries: [] };
  }
}

async function saveData(data) {
  await fetch(JSONBIN_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Access-Key': JSONBIN_KEY
    },
    body: JSON.stringify(data)
  });
}

async function loadData() {
  showLoader(true);
  allData = await getData();
  showLoader(false);
  renderStrategyFilters();
  renderDashboard();
  populateStrategyDropdown();
}

function showLoader(on) {
  let el = document.getElementById('globalLoader');
  if (!el) {
    el = document.createElement('div');
    el.id = 'globalLoader';
    el.style.cssText = 'position:fixed;top:0;left:0;right:0;height:2px;background:var(--accent);z-index:9999;transition:opacity 0.3s';
    document.body.appendChild(el);
  }
  el.style.opacity = on ? '1' : '0';
}

// ---- Navigation ----
function navigate(section) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item, .mobile-tab').forEach(n => n.classList.remove('active'));

  document.getElementById(`section-${section}`).classList.remove('hidden');
  document.querySelectorAll(`[data-section="${section}"]`).forEach(el => el.classList.add('active'));

  const titles = { dashboard: 'Execution Analysis', entries: 'Log Entry', strategies: 'Manage Strategies' };
  document.getElementById('pageTitle').textContent = titles[section];

  closeMobileSidebar();

  if (section === 'entries') { populateStrategyDropdown(); renderEntriesTable(); }
  if (section === 'strategies') renderStrategiesPage();
}

document.querySelectorAll('.nav-item, .mobile-tab').forEach(el => {
  el.addEventListener('click', e => {
    e.preventDefault();
    navigate(el.dataset.section);
  });
});

// ---- Mobile sidebar drawer ----
function closeMobileSidebar() {
  document.querySelector('.sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('active');
}

document.getElementById('mobileMenuBtn').addEventListener('click', () => {
  document.querySelector('.sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('active');
});

document.getElementById('sidebarOverlay').addEventListener('click', closeMobileSidebar);

// ---- Strategy Filter Chips ----
function renderStrategyFilters() {
  const container = document.getElementById('strategyFilters');
  const isAll = activeStrategies.has('all');

  container.innerHTML = `
    <label class="strategy-chip ${isAll ? 'active' : ''}" data-id="all">
      <span class="chip-dot" style="background:#ffffff22"></span> All Strategies
    </label>
    ${allData.strategies.map(s => `
      <label class="strategy-chip ${!isAll && activeStrategies.has(s.id) ? 'active' : ''}" data-id="${s.id}">
        <span class="chip-dot" style="background:${s.color}"></span> ${s.name}
      </label>
    `).join('')}
  `;

  container.querySelectorAll('.strategy-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const id = chip.dataset.id;
      if (id === 'all') {
        activeStrategies = new Set(['all']);
      } else {
        activeStrategies.delete('all');
        if (activeStrategies.has(id)) {
          activeStrategies.delete(id);
          // if nothing left, reset to all
          if (activeStrategies.size === 0) activeStrategies = new Set(['all']);
        } else {
          activeStrategies.add(id);
          // if all individual strategies selected, switch to 'all'
          if (activeStrategies.size === allData.strategies.length) activeStrategies = new Set(['all']);
        }
      }
      // re-render chips
      container.querySelectorAll('.strategy-chip').forEach(c => {
        const cid = c.dataset.id;
        c.classList.toggle('active',
          cid === 'all' ? activeStrategies.has('all') : (!activeStrategies.has('all') && activeStrategies.has(cid))
        );
      });
      renderDashboard();
    });
  });
}

// ---- Date Filter ----
document.getElementById('applyFilter').addEventListener('click', () => {
  fromDate = document.getElementById('dateFrom').value || null;
  toDate = document.getElementById('dateTo').value || null;
  updateDateLabel();
  renderDashboard();
});

document.getElementById('resetFilter').addEventListener('click', () => {
  fromDate = null;
  toDate = null;
  document.getElementById('dateFrom').value = '';
  document.getElementById('dateTo').value = '';
  updateDateLabel();
  renderDashboard();
});

function updateDateLabel() {
  const label = document.getElementById('dateRangeLabel');
  if (fromDate || toDate) {
    label.textContent = `${fromDate || '…'} → ${toDate || '…'}`;
  } else {
    label.textContent = 'All time';
  }
}

// ---- RENDER ALL ----
function renderAll() {
  renderStrategyFilters();
  renderDashboard();
}

function renderDashboard() {
  const entries = getFilteredEntries();
  renderKPIs(entries);
  renderLast30Chart(entries);
  renderDonutChart(entries);
  renderCalendar(entries);
  renderMonthlyChart(entries);
  renderCumulativeChart(entries);
  renderStrategyTable(entries);
}

// ---- KPIs ----
function renderKPIs(entries) {
  const container = document.getElementById('kpiRow');

  const totalPnl = entries.reduce((s, e) => s + e.pnl, 0);

  // Aggregate by date so multi-strategy days count as 1 trading day
  const byDay = {};
  entries.forEach(e => { byDay[e.date] = (byDay[e.date] || 0) + e.pnl; });
  const tradingDays = Object.values(byDay);
  const uniqueDayCount = tradingDays.length;
  const wins = tradingDays.filter(p => p > 0);
  const losses = tradingDays.filter(p => p < 0);
  const winRate = uniqueDayCount > 0 ? ((wins.length / uniqueDayCount) * 100).toFixed(1) : 0;
  const bestDay = wins.length > 0 ? Math.max(...wins) : 0;
  const worstDay = losses.length > 0 ? Math.min(...losses) : null;
  const avgWin = wins.length > 0 ? wins.reduce((s, v) => s + v, 0) / wins.length : 0;
  const avgLoss = losses.length > 0 ? losses.reduce((s, v) => s + v, 0) / losses.length : 0;
  // Sum capital across all active strategies on the latest date with data
  const latestDate = entries.length > 0 ? entries.map(e => e.date).sort().pop() : null;
  const latestFunds = latestDate
    ? entries.filter(e => e.date === latestDate).reduce((s, e) => s + e.investedFunds, 0)
    : 0;
  const returnPct = latestFunds > 0 ? ((totalPnl / latestFunds) * 100).toFixed(2) : 0;
  const profitFactor = Math.abs(avgLoss) > 0 ? (avgWin / Math.abs(avgLoss)).toFixed(2) : '∞';

  const kpis = [
    {
      label: 'Total P&L',
      value: fmtSigned(totalPnl),
      sub: `${uniqueDayCount} trading days`,
      color: totalPnl >= 0 ? 'var(--green)' : 'var(--red)',
      badge: totalPnl >= 0 ? '▲' : '▼'
    },
    {
      label: 'Return %',
      value: fmtPct(returnPct),
      sub: `on ₹${fmt(latestFunds)} deployed`,
      color: returnPct >= 0 ? 'var(--green)' : 'var(--red)',
      badge: '%'
    },
    {
      label: 'Win Rate',
      value: winRate + '%',
      sub: `${wins.length}W / ${losses.length}L`,
      color: 'var(--accent)',
      badge: '◉'
    },
    {
      label: 'Profit Factor',
      value: profitFactor,
      sub: `Avg win ₹${fmt(avgWin)}`,
      color: 'var(--gold)',
      badge: '⚡'
    },
    {
      label: 'Best Day',
      value: '+₹' + fmt(bestDay),
      sub: 'single session high',
      color: 'var(--green)',
      badge: '★'
    },
    {
      label: 'Worst Day',
      value: worstDay !== null ? '-₹' + fmt(Math.abs(worstDay)) : '—',
      sub: worstDay !== null ? 'max drawdown day' : 'no loss days',
      color: worstDay !== null ? 'var(--red)' : 'var(--text2)',
      badge: '↓'
    }
  ];

  container.innerHTML = kpis.map(k => `
    <div class="kpi-card" style="--kpi-color:${k.color}">
      <div class="kpi-badge">${k.badge}</div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value" style="color:${k.color}">${k.value}</div>
      <div class="kpi-sub">${k.sub}</div>
    </div>
  `).join('');
}

// ---- Chart: Last 30 Trading Days ----
function renderLast30Chart(entries) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));

  // Aggregate by date
  const byDate = {};
  sorted.forEach(e => {
    byDate[e.date] = (byDate[e.date] || 0) + e.pnl;
  });

  const dates = Object.keys(byDate).sort().slice(-30);
  const values = dates.map(d => byDate[d]);
  const colors = values.map(v => v >= 0 ? 'rgba(0,230,118,0.8)' : 'rgba(255,61,87,0.8)');
  const borders = values.map(v => v >= 0 ? '#00e676' : '#ff3d57');

  destroyChart('last30');
  const ctx = document.getElementById('chartLast30').getContext('2d');
  charts.last30 = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: dates.map(d => {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      }),
      datasets: [{
        label: 'P&L',
        data: values,
        backgroundColor: colors,
        borderColor: borders,
        borderWidth: 1.5,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => ' ' + fmtSigned(ctx.raw)
          },
          backgroundColor: '#161b23',
          borderColor: '#ffffff20',
          borderWidth: 1,
          titleColor: '#8892a4',
          bodyColor: '#e8edf5',
          bodyFont: { family: 'JetBrains Mono' }
        }
      },
      scales: {
        x: {
          grid: { color: '#ffffff08' },
          ticks: { color: '#4a5568', font: { size: 10, family: 'JetBrains Mono' }, maxRotation: 45 }
        },
        y: {
          grid: { color: '#ffffff08' },
          ticks: {
            color: '#4a5568',
            font: { size: 10, family: 'JetBrains Mono' },
            callback: v => '₹' + (Math.abs(v) >= 1000 ? (v / 1000).toFixed(1) + 'k' : v)
          }
        }
      }
    }
  });
}

// ---- Chart: Donut (Strategy Split) ----
function renderDonutChart(entries) {
  const byStrategy = {};
  entries.forEach(e => {
    byStrategy[e.strategy] = (byStrategy[e.strategy] || 0) + Math.max(0, e.pnl);
  });

  const strats = Object.keys(byStrategy);
  const values = strats.map(s => byStrategy[s]);
  const colors = strats.map(s => getStrategyColor(s));
  const names = strats.map(s => getStrategyName(s));

  destroyChart('donut');
  const ctx = document.getElementById('chartDonut').getContext('2d');
  charts.donut = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: names,
      datasets: [{
        data: values,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor: colors,
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: '#8892a4',
            font: { size: 11, family: 'JetBrains Mono' },
            padding: 12,
            usePointStyle: true,
            pointStyleWidth: 8
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ₹${fmt(ctx.raw)}`
          },
          backgroundColor: '#161b23',
          borderColor: '#ffffff20',
          borderWidth: 1,
          titleColor: '#8892a4',
          bodyColor: '#e8edf5',
          bodyFont: { family: 'JetBrains Mono' }
        }
      }
    }
  });
}

// ---- Calendar ---- 3-month compact heatmap ----
function buildOneMonth(year, month, byDate) {
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const days = ['S','M','T','W','T','F','S'];
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  let html = `<div class="cal-month-block">`;
  html += `<div class="cal-month-title">${monthNames[month]} ${year}</div>`;
  html += `<div class="cal-mini-grid">`;
  html += days.map(d => `<div class="cal-day-header">${d}</div>`).join('');

  for (let i = 0; i < firstDay; i++) {
    html += `<div class="cal-day empty"><span class="cal-day-num"></span></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dow = new Date(year, month, d).getDay();
    const isWeekend = dow === 0 || dow === 6;
    const pnl = byDate[dateStr];

    let cls;
    let title = '';
    if (isWeekend) {
      cls = 'weekend';
    } else if (pnl !== undefined) {
      cls = pnl >= 0 ? 'profit' : 'loss';
      const abs = Math.abs(pnl);
      const s = abs >= 1000 ? (abs / 1000).toFixed(1) + 'k' : abs;
      title = `title="${pnl >= 0 ? '+' : '-'}₹${s}"`;
    } else {
      cls = 'no-trade';
    }

    html += `<div class="cal-day ${cls}" ${title}><span class="cal-day-num">${d}</span></div>`;
  }

  html += `</div></div>`;
  return html;
}

function renderCalendar(entries) {
  const byDate = {};
  entries.forEach(e => {
    byDate[e.date] = (byDate[e.date] || 0) + e.pnl;
  });

  // Show 3 months: 2 months ago, last month, current month
  const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  const months = [-2, -1, 0].map(offset => {
    let m = calMonth + offset;
    let y = calYear;
    while (m < 0) { m += 12; y--; }
    while (m > 11) { m -= 12; y++; }
    return { y, m };
  });

  document.getElementById('calMonthLabel').textContent =
    `${monthNames[months[0].m]} – ${monthNames[months[2].m]} ${months[2].y}`;

  const grid = document.getElementById('calendarGrid');
  grid.innerHTML = months.map(({ y, m }) => buildOneMonth(y, m, byDate)).join('');
}

document.getElementById('calPrev').addEventListener('click', () => {
  calMonth--;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  renderCalendar(getFilteredEntries());
});

document.getElementById('calNext').addEventListener('click', () => {
  calMonth++;
  if (calMonth > 11) { calMonth = 0; calYear++; }
  renderCalendar(getFilteredEntries());
});

// ---- Chart: Monthly P&L % — split by strategy ----
function renderMonthlyChart(entries) {
  // Determine which strategies are active in these entries
  const activeIds = [...new Set(entries.map(e => e.strategy))];
  const strategies = allData.strategies.filter(s => activeIds.includes(s.id));

  // Collect all months
  const monthSet = new Set(entries.map(e => e.date.substring(0, 7)));
  const months = [...monthSet].sort();

  if (!months.length) {
    destroyChart('monthly');
    return;
  }

  const monthLabels = months.map(m => {
    const [y, mo] = m.split('-');
    return new Date(+y, +mo - 1, 1).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
  });

  // Build one dataset per strategy
  const datasets = strategies.map(s => {
    const data = months.map(month => {
      const sEntries = entries.filter(e => e.strategy === s.id && e.date.startsWith(month));
      if (!sEntries.length) return null;
      const pnl = sEntries.reduce((sum, e) => sum + e.pnl, 0);
      const maxFunds = Math.max(...sEntries.map(e => e.investedFunds));
      return maxFunds > 0 ? +((pnl / maxFunds) * 100).toFixed(2) : 0;
    });

    const hex = s.color;
    return {
      label: s.name,
      data,
      backgroundColor: data.map(v => v === null ? 'transparent' : v >= 0 ? hex + 'cc' : '#ff3d57cc'),
      borderColor: data.map(v => v === null ? 'transparent' : v >= 0 ? hex : '#ff3d57'),
      borderWidth: 1.5,
      borderRadius: 4,
      skipNull: true
    };
  });

  // If only 1 strategy, also add a total bar
  if (strategies.length > 1) {
    const totalData = months.map(month => {
      const mEntries = entries.filter(e => e.date.startsWith(month));
      if (!mEntries.length) return null;
      const pnl = mEntries.reduce((sum, e) => sum + e.pnl, 0);
      // sum invested funds per strategy for this month (latest value per strategy)
      const stratFunds = [...new Set(mEntries.map(e => e.strategy))].reduce((sum, sid) => {
        const se = mEntries.filter(e => e.strategy === sid);
        return sum + Math.max(...se.map(e => e.investedFunds));
      }, 0);
      return stratFunds > 0 ? +((pnl / stratFunds) * 100).toFixed(2) : 0;
    });
    datasets.push({
      label: 'Total',
      data: totalData,
      backgroundColor: totalData.map(v => v === null ? 'transparent' : v >= 0 ? 'rgba(255,255,255,0.12)' : 'rgba(255,61,87,0.15)'),
      borderColor: totalData.map(v => v === null ? 'transparent' : v >= 0 ? 'rgba(255,255,255,0.4)' : '#ff3d57'),
      borderWidth: 1.5,
      borderRadius: 4,
      borderDash: [4, 3],
      type: 'line',
      pointRadius: 3,
      pointHoverRadius: 5,
      fill: false,
      tension: 0.3,
      order: 0
    });
  }

  destroyChart('monthly');
  const ctx = document.getElementById('chartMonthly').getContext('2d');
  charts.monthly = new Chart(ctx, {
    type: 'bar',
    data: { labels: monthLabels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: strategies.length > 1,
          labels: {
            color: '#8892a4',
            font: { size: 10, family: 'JetBrains Mono' },
            usePointStyle: true,
            pointStyleWidth: 8,
            padding: 12
          }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.raw !== null ? fmtPct(ctx.raw) : '—'}`
          },
          backgroundColor: '#161b23',
          borderColor: '#ffffff20',
          borderWidth: 1,
          titleColor: '#8892a4',
          bodyColor: '#e8edf5',
          bodyFont: { family: 'JetBrains Mono' }
        }
      },
      scales: {
        x: {
          grid: { color: '#ffffff08' },
          ticks: { color: '#4a5568', font: { size: 10, family: 'JetBrains Mono' } }
        },
        y: {
          grid: { color: '#ffffff08' },
          ticks: {
            color: '#4a5568',
            font: { size: 10, family: 'JetBrains Mono' },
            callback: v => v + '%'
          }
        }
      }
    }
  });
}

// ---- Chart: Cumulative P&L ----
function renderCumulativeChart(entries) {
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  const byDate = {};
  sorted.forEach(e => {
    byDate[e.date] = (byDate[e.date] || 0) + e.pnl;
  });

  const dates = Object.keys(byDate).sort();
  let cum = 0;
  const cumValues = dates.map(d => { cum += byDate[d]; return cum; });

  destroyChart('cumulative');
  const ctx = document.getElementById('chartCumulative').getContext('2d');
  charts.cumulative = new Chart(ctx, {
    type: 'line',
    data: {
      labels: dates.map(d => {
        const dt = new Date(d + 'T00:00:00');
        return dt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      }),
      datasets: [{
        label: 'Cumulative P&L',
        data: cumValues,
        borderColor: '#00d4ff',
        borderWidth: 2,
        pointRadius: 2,
        pointHoverRadius: 5,
        fill: true,
        backgroundColor: (context) => {
          const chart = context.chart;
          const {ctx: c, chartArea} = chart;
          if (!chartArea) return 'transparent';
          const grad = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          grad.addColorStop(0, 'rgba(0,212,255,0.3)');
          grad.addColorStop(1, 'rgba(0,212,255,0.02)');
          return grad;
        },
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ' ' + fmtSigned(ctx.raw) },
          backgroundColor: '#161b23',
          borderColor: '#ffffff20',
          borderWidth: 1,
          titleColor: '#8892a4',
          bodyColor: '#e8edf5',
          bodyFont: { family: 'JetBrains Mono' }
        }
      },
      scales: {
        x: {
          grid: { color: '#ffffff08' },
          ticks: { color: '#4a5568', font: { size: 10, family: 'JetBrains Mono' }, maxTicksLimit: 8 }
        },
        y: {
          grid: { color: '#ffffff08' },
          ticks: {
            color: '#4a5568',
            font: { size: 10, family: 'JetBrains Mono' },
            callback: v => '₹' + (v >= 1000 || v <= -1000 ? (v / 1000).toFixed(1) + 'k' : v)
          }
        }
      }
    }
  });
}

// ---- Chart: Win/Loss Distribution ----
function renderWinLossChart(entries) {
  const wins = entries.filter(e => e.pnl > 0).map(e => e.pnl);
  const losses = entries.filter(e => e.pnl < 0).map(e => Math.abs(e.pnl));

  const bucketize = (arr, n = 8) => {
    if (!arr.length) return { labels: [], data: [] };
    const min = Math.min(...arr), max = Math.max(...arr);
    const step = (max - min) / n || 1;
    const buckets = Array(n).fill(0);
    arr.forEach(v => {
      const idx = Math.min(Math.floor((v - min) / step), n - 1);
      buckets[idx]++;
    });
    const labels = Array.from({ length: n }, (_, i) => {
      const val = min + i * step;
      return val >= 1000 ? '₹' + (val / 1000).toFixed(1) + 'k' : '₹' + Math.round(val);
    });
    return { labels, data: buckets };
  };

  const wb = bucketize(wins);
  const lb = bucketize(losses);

  destroyChart('winloss');
  const ctx = document.getElementById('chartWinLoss').getContext('2d');
  charts.winloss = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: wb.labels.length >= lb.labels.length ? wb.labels : lb.labels,
      datasets: [
        {
          label: 'Wins',
          data: wb.data,
          backgroundColor: 'rgba(0,230,118,0.7)',
          borderColor: '#00e676',
          borderWidth: 1,
          borderRadius: 3
        },
        {
          label: 'Losses',
          data: lb.data,
          backgroundColor: 'rgba(255,61,87,0.7)',
          borderColor: '#ff3d57',
          borderWidth: 1,
          borderRadius: 3
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          labels: {
            color: '#8892a4',
            font: { size: 11, family: 'JetBrains Mono' },
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: '#161b23',
          borderColor: '#ffffff20',
          borderWidth: 1,
          titleColor: '#8892a4',
          bodyColor: '#e8edf5',
          bodyFont: { family: 'JetBrains Mono' }
        }
      },
      scales: {
        x: {
          grid: { color: '#ffffff08' },
          ticks: { color: '#4a5568', font: { size: 10, family: 'JetBrains Mono' } }
        },
        y: {
          grid: { color: '#ffffff08' },
          ticks: { color: '#4a5568', font: { size: 10, family: 'JetBrains Mono' } }
        }
      }
    }
  });
}

// ---- Strategy Table ----
function renderStrategyTable(entries) {
  const container = document.getElementById('strategyTable');

  const stats = {};
  allData.strategies.forEach(s => {
    stats[s.id] = { name: s.name, color: s.color, pnl: 0, trades: 0, wins: 0, maxFunds: 0 };
  });

  entries.forEach(e => {
    if (!stats[e.strategy]) return;
    stats[e.strategy].pnl += e.pnl;
    stats[e.strategy].trades++;
    if (e.pnl > 0) stats[e.strategy].wins++;
    stats[e.strategy].maxFunds = Math.max(stats[e.strategy].maxFunds, e.investedFunds);
  });

  const rows = Object.entries(stats)
    .filter(([, v]) => v.trades > 0)
    .sort((a, b) => b[1].pnl - a[1].pnl);

  if (!rows.length) {
    container.innerHTML = '<div style="padding:20px;color:var(--text3);font-family:var(--mono);font-size:13px">No data for selected filters.</div>';
    return;
  }

  const maxPnl = Math.max(...rows.map(([, v]) => Math.abs(v.pnl)));

  container.innerHTML = `
    <table class="strat-table">
      <thead>
        <tr>
          <th>Strategy</th>
          <th>Total P&L</th>
          <th>Return %</th>
          <th>Trades</th>
          <th>Win Rate</th>
          <th>Deployed Capital</th>
          <th>Performance</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(([id, v]) => {
          const ret = v.maxFunds > 0 ? ((v.pnl / v.maxFunds) * 100).toFixed(2) : 0;
          const wr = v.trades > 0 ? ((v.wins / v.trades) * 100).toFixed(1) : 0;
          const barW = maxPnl > 0 ? (Math.abs(v.pnl) / maxPnl * 100).toFixed(1) : 0;
          return `
            <tr>
              <td>
                <div class="strat-name-cell">
                  <span class="strat-dot" style="background:${v.color}"></span>
                  ${v.name}
                </div>
              </td>
              <td class="${v.pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}">${fmtSigned(v.pnl)}</td>
              <td class="${ret >= 0 ? 'pnl-pos' : 'pnl-neg'}">${fmtPct(ret)}</td>
              <td>${v.trades}</td>
              <td>${wr}%</td>
              <td>₹${fmt(v.maxFunds)}</td>
              <td>
                <div class="pct-bar-wrap">
                  <div class="pct-bar" style="width:${barW}%;background:${v.pnl >= 0 ? 'var(--green)' : 'var(--red)'}"></div>
                </div>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

// ---- Entries Table ----
function renderEntriesTable() {
  const entries = getFilteredEntries();
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 50);
  const container = document.getElementById('entriesTable');

  if (!sorted.length) {
    container.innerHTML = '<div style="padding:20px;color:var(--text3);font-family:var(--mono)">No entries found.</div>';
    return;
  }

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Strategy</th>
          <th>Invested Funds</th>
          <th>P&L</th>
          <th>Return</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${sorted.map(e => {
          const ret = e.investedFunds > 0 ? ((e.pnl / e.investedFunds) * 100).toFixed(2) : 0;
          return `
            <tr>
              <td>${e.date}</td>
              <td>
                <span style="display:flex;align-items:center;gap:6px">
                  <span style="width:7px;height:7px;border-radius:50%;background:${getStrategyColor(e.strategy)};display:inline-block"></span>
                  ${getStrategyName(e.strategy)}
                </span>
              </td>
              <td>₹${fmt(e.investedFunds)}</td>
              <td class="${e.pnl >= 0 ? 'pnl-pos' : 'pnl-neg'}">${fmtSigned(e.pnl)}</td>
              <td class="${ret >= 0 ? 'pnl-pos' : 'pnl-neg'}">${fmtPct(ret)}</td>
              <td>
                <button class="del-btn" onclick="deleteEntry('${e.date}','${e.strategy}')">✕</button>
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;
}

async function deleteEntry(date, strategy) {
  if (!await confirmModal(`Delete entry for <b>${getStrategyName(strategy)}</b> on ${date}?`)) return;
  if (!await secretKeyModal()) return;
  const data = await getData();
  data.entries = data.entries.filter(e => !(e.date === date && e.strategy === strategy));
  await saveData(data);
  await loadData();
  renderEntriesTable();
}

// ---- Log Entry Form ----
function populateStrategyDropdown() {
  const sel = document.getElementById('entryStrategy');
  sel.innerHTML = '<option value="">Select strategy</option>' +
    allData.strategies.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
}

document.getElementById('saveEntry').addEventListener('click', async () => {
  const date = document.getElementById('entryDate').value;
  const strategy = document.getElementById('entryStrategy').value;
  const investedFunds = document.getElementById('entryFunds').value;
  const pnl = document.getElementById('entryPnl').value;
  const msg = document.getElementById('entryMsg');

  if (!date || !strategy || investedFunds === '' || pnl === '') {
    msg.textContent = '✗ All fields required';
    msg.className = 'form-msg err';
    return;
  }

  const data = await getData();
  const existingIdx = data.entries.findIndex(e => e.date === date && e.strategy === strategy);
  const entry = { date, strategy, investedFunds: +investedFunds, pnl: +pnl };
  if (existingIdx >= 0) {
    data.entries[existingIdx] = entry;
  } else {
    data.entries.push(entry);
  }
  data.entries.sort((a, b) => a.date.localeCompare(b.date));
  await saveData(data);

  msg.textContent = '✓ Entry saved!';
  msg.className = 'form-msg ok';
  document.getElementById('entryDate').value = '';
  document.getElementById('entryFunds').value = '';
  document.getElementById('entryPnl').value = '';
  await loadData();
  renderEntriesTable();
  setTimeout(() => msg.textContent = '', 3000);
});

// ---- Strategies Page ----
function renderStrategiesPage() {
  populateStrategyDropdown();
  const list = document.getElementById('strategiesList');

  if (!allData.strategies.length) {
    list.innerHTML = '<div style="padding:20px;color:var(--text3);font-family:var(--mono)">No strategies yet.</div>';
    return;
  }

  list.innerHTML = allData.strategies.map(s => {
    const trades = allData.entries.filter(e => e.strategy === s.id).length;
    const pnl = allData.entries.filter(e => e.strategy === s.id).reduce((a, e) => a + e.pnl, 0);
    return `
      <div class="strategy-row">
        <div class="strat-color-swatch" style="background:${s.color}"></div>
        <div class="strat-info">
          <div class="strat-row-name">${s.name}</div>
          <div class="strat-row-id">id: ${s.id} · ${trades} trades · ${fmtSigned(pnl)}</div>
        </div>
        <button class="del-btn" onclick="deleteStrategy('${s.id}')">Delete</button>
      </div>
    `;
  }).join('');
}

async function deleteStrategy(id) {
  if (!await confirmModal(`Delete strategy "<b>${getStrategyName(id)}</b>" and all its entries?`)) return;
  if (!await secretKeyModal()) return;
  const data = await getData();
  data.strategies = data.strategies.filter(s => s.id !== id);
  data.entries = data.entries.filter(e => e.strategy !== id);
  await saveData(data);
  await loadData();
  renderStrategiesPage();
}

document.getElementById('saveStrategy').addEventListener('click', async () => {
  const name = document.getElementById('stratName').value.trim();
  const color = document.getElementById('stratColor').value;
  const msg = document.getElementById('stratMsg');

  if (!name) {
    msg.textContent = '✗ Name required';
    msg.className = 'form-msg err';
    return;
  }

  const data = await getData();
  const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  if (data.strategies.find(s => s.id === id)) {
    msg.textContent = '✗ Strategy already exists';
    msg.className = 'form-msg err';
    return;
  }
  data.strategies.push({ id, name, color });
  await saveData(data);

  msg.textContent = '✓ Strategy added!';
  msg.className = 'form-msg ok';
  document.getElementById('stratName').value = '';
  await loadData();
  renderStrategiesPage();
  setTimeout(() => msg.textContent = '', 3000);
});

// ---- Confirm modal ----
function confirmModal(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-msg">${message}</div>
        <div class="confirm-actions">
          <button class="confirm-cancel">Cancel</button>
          <button class="confirm-ok">Delete</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const cleanup = (result) => { overlay.remove(); resolve(result); };
    overlay.querySelector('.confirm-ok').addEventListener('click', () => cleanup(true));
    overlay.querySelector('.confirm-cancel').addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
  });
}

// ---- Secret key modal ----
const DELETE_SECRET = '7357567373';

function secretKeyModal() {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <div class="confirm-msg">Enter secret key to confirm deletion:</div>
        <input class="secret-input" type="password" placeholder="Secret key" autocomplete="off" />
        <div class="secret-error" style="display:none;color:var(--red);font-family:var(--mono);font-size:12px;margin-top:6px">Incorrect key</div>
        <div class="confirm-actions" style="margin-top:16px">
          <button class="confirm-cancel">Cancel</button>
          <button class="confirm-ok">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    const input = overlay.querySelector('.secret-input');
    const errEl = overlay.querySelector('.secret-error');
    input.focus();

    const cleanup = (result) => { overlay.remove(); resolve(result); };

    overlay.querySelector('.confirm-ok').addEventListener('click', () => {
      if (input.value === DELETE_SECRET) {
        cleanup(true);
      } else {
        errEl.style.display = 'block';
        input.value = '';
        input.focus();
      }
    });
    overlay.querySelector('.confirm-cancel').addEventListener('click', () => cleanup(false));
    overlay.addEventListener('click', e => { if (e.target === overlay) cleanup(false); });
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') overlay.querySelector('.confirm-ok').click();
      if (e.key === 'Escape') cleanup(false);
    });
  });
}

// ---- Toast notification ----
function toast(msg, type = 'ok', duration = 3000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), duration);
}

// ---- Export JSON ----
document.getElementById('exportJson').addEventListener('click', () => {
  const json = JSON.stringify(allData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `trades-backup-${date}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Exported trades-backup.json');
});

// ---- Export CSV ----
document.getElementById('exportCsv').addEventListener('click', () => {
  const rows = [['Date', 'Strategy', 'Strategy Name', 'Invested Funds', 'PnL', 'Return %']];
  const sorted = [...allData.entries].sort((a, b) => a.date.localeCompare(b.date));
  sorted.forEach(e => {
    const name = getStrategyName(e.strategy);
    const ret = e.investedFunds > 0 ? ((e.pnl / e.investedFunds) * 100).toFixed(2) : '0';
    rows.push([e.date, e.strategy, name, e.investedFunds, e.pnl, ret]);
  });
  const csv = rows.map(r => r.map(v => '"' + v + '"').join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const date = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `trades-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast('Exported trades.csv');
});

// ---- Import JSON ----
document.getElementById('importFile').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  e.target.value = ''; // reset so same file can be re-imported

  const reader = new FileReader();
  reader.onload = async (ev) => {
    let parsed;
    try {
      parsed = JSON.parse(ev.target.result);
    } catch {
      toast('Invalid JSON file', 'err'); return;
    }
    if (!parsed.strategies || !parsed.entries) {
      toast('File missing strategies or entries', 'err'); return;
    }

    const confirmed = await confirmModal(
      `Import will <b>replace all current data</b> with:<br><br>` +
      `• ${parsed.strategies.length} strategies<br>` +
      `• ${parsed.entries.length} entries<br><br>` +
      `Make sure you have a backup.`
    );
    if (!confirmed) return;

    const data = {
      strategies: parsed.strategies,
      entries: parsed.entries.sort((a, b) => a.date.localeCompare(b.date))
    };
    await saveData(data);
    toast(`Imported ${data.entries.length} entries across ${data.strategies.length} strategies`);
    await loadData();
  };
  reader.readAsText(file);
});

// ---- Migrate localStorage → JSONBin (runs once, then removes the local key) ----
async function migrateLocalStorage() {
  const raw = localStorage.getItem('tradedesk_data');
  if (!raw) return;
  try {
    const local = JSON.parse(raw);
    if (!local.entries?.length && !local.strategies?.length) return;
    const remote = await getData();
    if (remote.entries.length === 0 && remote.strategies.length === 0) {
      await saveData(local);
      toast('Migrated local data to cloud ✓');
    }
    localStorage.removeItem('tradedesk_data');
  } catch {}
}

// ---- Init ----
async function init() {
  const now = new Date();
  calYear = now.getFullYear();
  calMonth = now.getMonth();
  await migrateLocalStorage();
  await loadData();
}
init();
