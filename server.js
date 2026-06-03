const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

module.exports = app;

if (require.main === module) {
  app.listen(PORT, () => {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║   Trading Dashboard is running!        ║');
    console.log(`║   Open: http://localhost:${PORT}          ║`);
    console.log('╚════════════════════════════════════════╝\n');
  });
}
