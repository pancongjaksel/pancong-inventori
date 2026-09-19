require('dotenv').config();
const express = require('express');
const cors = require('cors');

const outletsRouter = require('./routes/outlets');
const checklistItemsRouter = require('./routes/checklistItems');
const submissionsRouter = require('./routes/submissions');

const app = express();

app.use(cors()); // frontend di Netlify, domain beda — perlu CORS terbuka
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.use('/api/outlets', outletsRouter);
app.use('/api/checklist-items', checklistItemsRouter);
app.use('/api/submissions', submissionsRouter);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[unhandled]', err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4010;
app.listen(PORT, () => {
  console.log(`[checklist-api] listening on port ${PORT}`);
});
