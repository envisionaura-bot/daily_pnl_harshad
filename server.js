const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'trades.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---- Storage: file locally, Vercel KV in production ----
let kv = null;
if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
  kv = require('@vercel/kv');
}

const KV_KEY = 'trades';

async function readData() {
  if (kv) {
    const data = await kv.get(KV_KEY);
    if (data) return data;
    // Seed from bundled file on first run
    try {
      const seed = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      await kv.set(KV_KEY, seed);
      return seed;
    } catch { return { strategies: [], entries: [] }; }
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { strategies: [], entries: [] };
  }
}

async function writeData(data) {
  if (kv) {
    await kv.set(KV_KEY, data);
    return;
  }
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// GET all data
app.get('/api/data', async (req, res) => {
  res.json(await readData());
});

// GET strategies
app.get('/api/strategies', async (req, res) => {
  res.json((await readData()).strategies);
});

// POST add strategy
app.post('/api/strategies', async (req, res) => {
  const { name, color } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });

  const data = await readData();
  const id = name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');

  if (data.strategies.find(s => s.id === id)) {
    return res.status(409).json({ error: 'Strategy already exists' });
  }

  const strategy = { id, name, color: color || '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0') };
  data.strategies.push(strategy);
  await writeData(data);
  res.json(strategy);
});

// DELETE strategy
app.delete('/api/strategies/:id', async (req, res) => {
  const data = await readData();
  data.strategies = data.strategies.filter(s => s.id !== req.params.id);
  data.entries = data.entries.filter(e => e.strategy !== req.params.id);
  await writeData(data);
  res.json({ success: true });
});

// GET entries with optional filters
app.get('/api/entries', async (req, res) => {
  const { strategy, from, to } = req.query;
  let entries = (await readData()).entries;

  if (strategy && strategy !== 'all') {
    entries = entries.filter(e => e.strategy === strategy);
  }
  if (from) entries = entries.filter(e => e.date >= from);
  if (to) entries = entries.filter(e => e.date <= to);

  res.json(entries);
});

// POST add entry
app.post('/api/entries', async (req, res) => {
  const { date, strategy, investedFunds, pnl } = req.body;
  if (!date || !strategy || investedFunds == null || pnl == null) {
    return res.status(400).json({ error: 'date, strategy, investedFunds, pnl required' });
  }

  const data = await readData();

  const existingIdx = data.entries.findIndex(e => e.date === date && e.strategy === strategy);
  if (existingIdx >= 0) {
    data.entries[existingIdx] = { date, strategy, investedFunds: Number(investedFunds), pnl: Number(pnl) };
  } else {
    data.entries.push({ date, strategy, investedFunds: Number(investedFunds), pnl: Number(pnl) });
  }

  data.entries.sort((a, b) => a.date.localeCompare(b.date));
  await writeData(data);
  res.json({ success: true });
});

// DELETE entry
app.delete('/api/entries', async (req, res) => {
  const { date, strategy } = req.body;
  const data = await readData();
  data.entries = data.entries.filter(e => !(e.date === date && e.strategy === strategy));
  await writeData(data);
  res.json({ success: true });
});

// Analytics: monthly summary
app.get('/api/analytics/monthly', async (req, res) => {
  const { strategy } = req.query;
  let entries = (await readData()).entries;
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

// POST import
app.post('/api/import', async (req, res) => {
  const { strategies, entries } = req.body;
  if (!Array.isArray(strategies) || !Array.isArray(entries)) {
    return res.status(400).json({ error: 'Invalid format: strategies and entries arrays required' });
  }
  for (const e of entries) {
    if (!e.date || !e.strategy || e.investedFunds == null || e.pnl == null) {
      return res.status(400).json({ error: `Invalid entry: ${JSON.stringify(e)}` });
    }
  }
  const data = { strategies, entries: entries.sort((a, b) => a.date.localeCompare(b.date)) };
  await writeData(data);
  res.json({ success: true, strategies: strategies.length, entries: entries.length });
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
