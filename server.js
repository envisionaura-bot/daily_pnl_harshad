const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'trades.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: read data
function readData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return { strategies: [], entries: [] };
  }
}

// Helper: write data
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET all data
app.get('/api/data', (req, res) => {
  res.json(readData());
});

// GET strategies
app.get('/api/strategies', (req, res) => {
  res.json(readData().strategies);
});

// POST add strategy
app.post('/api/strategies', (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  const data = readData();
  const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  if (data.strategies.find(s => s.id === id)) {
    return res.status(409).json({ error: 'Strategy already exists' });
  }

  const strategy = { id, name, color: color || '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') };
  data.strategies.push(strategy);
  writeData(data);
  res.json(strategy);
});

// DELETE strategy
app.delete('/api/strategies/:id', (req, res) => {
  const data = readData();
  data.strategies = data.strategies.filter(s => s.id !== req.params.id);
  data.entries = data.entries.filter(e => e.strategy !== req.params.id);
  writeData(data);
  res.json({ success: true });
});

// GET entries with optional filters
app.get('/api/entries', (req, res) => {
  const { strategy, from, to } = req.query;
  let entries = readData().entries;

  if (strategy && strategy !== 'all') {
    entries = entries.filter(e => e.strategy === strategy);
  }
  if (from) entries = entries.filter(e => e.date >= from);
  if (to) entries = entries.filter(e => e.date <= to);

  res.json(entries);
});

// POST add entry
app.post('/api/entries', (req, res) => {
  const { date, strategy, investedFunds, pnl } = req.body;
  if (!date || !strategy || investedFunds == null || pnl == null) {
    return res.status(400).json({ error: 'date, strategy, investedFunds, pnl required' });
  }

  const data = readData();

  // Check if entry for same date+strategy already exists
  const existingIdx = data.entries.findIndex(e => e.date === date && e.strategy === strategy);
  if (existingIdx >= 0) {
    // Update existing
    data.entries[existingIdx] = { date, strategy, investedFunds: Number(investedFunds), pnl: Number(pnl) };
  } else {
    data.entries.push({ date, strategy, investedFunds: Number(investedFunds), pnl: Number(pnl) });
  }

  // Sort by date
  data.entries.sort((a, b) => a.date.localeCompare(b.date));
  writeData(data);
  res.json({ success: true });
});

// DELETE entry
app.delete('/api/entries', (req, res) => {
  const { date, strategy } = req.body;
  const data = readData();
  data.entries = data.entries.filter(e => !(e.date === date && e.strategy === strategy));
  writeData(data);
  res.json({ success: true });
});

// Analytics: monthly summary
app.get('/api/analytics/monthly', (req, res) => {
  const { strategy } = req.query;
  let entries = readData().entries;
  if (strategy && strategy !== 'all') {
    entries = entries.filter(e => e.strategy === strategy);
  }

  const monthly = {};
  entries.forEach(e => {
    const key = e.date.substring(0, 7);
    if (!monthly[key]) monthly[key] = { pnl: 0, invested: 0, days: 0 };
    monthly[key].pnl += e.pnl;
    monthly[key].invested = Math.max(monthly[key].invested, e.investedFunds);
    monthly[key].days++;
  });

  const result = Object.entries(monthly).map(([month, v]) => ({
    month,
    pnl: v.pnl,
    pct: v.invested > 0 ? ((v.pnl / v.invested) * 100).toFixed(2) : 0,
    days: v.days
  })).sort((a, b) => a.month.localeCompare(b.month));

  res.json(result);
});

// Serve index for any unmatched route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║   Trading Dashboard is running!        ║');
  console.log(`║   Open: http://localhost:${PORT}          ║`);
  console.log('╚════════════════════════════════════════╝\n');
});
