const express = require('express');
const { query, withTransaction } = require('../db');

const router = express.Router();

const VALID_TYPES = ['opening', 'closing'];

// POST /api/submissions — submit checklist, idempotent lewat client_uuid
// Body: { client_uuid, outlet_id, tipe, nama_crew, items: [{item_id, checked, skipped, skip_reason}] }
router.post('/', async (req, res) => {
  const { client_uuid, outlet_id, tipe, nama_crew, items } = req.body;

  if (!client_uuid || !outlet_id || !tipe || !nama_crew || !nama_crew.trim()) {
    return res.status(400).json({ error: 'client_uuid, outlet_id, tipe, dan nama_crew wajib diisi' });
  }
  if (!VALID_TYPES.includes(tipe)) {
    return res.status(400).json({ error: 'tipe harus opening atau closing' });
  }
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'items wajib berupa array dan tidak boleh kosong' });
  }

  try {
    // Idempotency check — kalau client_uuid ini udah pernah masuk (misal retry dari offline queue),
    // balikin submission yang sudah ada, jangan bikin duplikat.
    const existing = await query(
      'SELECT id FROM checklist_submissions WHERE client_uuid = $1',
      [client_uuid]
    );
    if (existing.rowCount > 0) {
      return res.status(200).json({ id: existing.rows[0].id, already_synced: true });
    }

    const checkedCount = items.filter((it) => it.checked).length;
    const completionPct = Math.round((checkedCount / items.length) * 10000) / 100;

    const submissionId = await withTransaction(async (client) => {
      const subResult = await client.query(
        `INSERT INTO checklist_submissions
           (client_uuid, outlet_id, tipe, nama_crew, completion_pct)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [client_uuid, outlet_id, tipe, nama_crew.trim(), completionPct]
      );
      const subId = subResult.rows[0].id;

      for (const it of items) {
        await client.query(
          `INSERT INTO checklist_submission_items
             (submission_id, item_id, checked, skipped, skip_reason)
           VALUES ($1, $2, $3, $4, $5)`,
          [subId, it.item_id, !!it.checked, !!it.skipped, it.skip_reason || null]
        );
      }

      return subId;
    });

    res.status(201).json({ id: submissionId, already_synced: false, completion_pct: completionPct });
  } catch (err) {
    // Duplicate client_uuid race (dua request bersamaan) — anggap sukses, ambil yang sudah tersimpan
    if (err.code === '23505') {
      const existing = await query(
        'SELECT id FROM checklist_submissions WHERE client_uuid = $1',
        [client_uuid]
      );
      if (existing.rowCount > 0) {
        return res.status(200).json({ id: existing.rows[0].id, already_synced: true });
      }
    }
    console.error('[submissions.post]', err);
    res.status(500).json({ error: 'Gagal menyimpan submission' });
  }
});

// GET /api/submissions?outlet_id=&search=&limit=&offset= — riwayat
router.get('/', async (req, res) => {
  const { outlet_id, search, limit = 50, offset = 0 } = req.query;

  const conditions = [];
  const values = [];
  let idx = 1;

  if (outlet_id) {
    conditions.push(`s.outlet_id = $${idx++}`);
    values.push(outlet_id);
  }
  if (search) {
    conditions.push(`s.nama_crew ILIKE $${idx++}`);
    values.push(`%${search}%`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit, offset);

  try {
    const result = await query(
      `SELECT s.id, s.outlet_id, o.nama AS outlet_nama, s.tipe, s.nama_crew,
              s.completion_pct, s.submitted_at
       FROM checklist_submissions s
       JOIN checklist_outlets o ON o.id = s.outlet_id
       ${whereClause}
       ORDER BY s.submitted_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      values
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[submissions.list]', err);
    res.status(500).json({ error: 'Gagal mengambil riwayat submission' });
  }
});

// GET /api/submissions/:id — detail 1 submission + item2nya
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const header = await query(
      `SELECT s.id, s.outlet_id, o.nama AS outlet_nama, s.tipe, s.nama_crew,
              s.completion_pct, s.submitted_at
       FROM checklist_submissions s
       JOIN checklist_outlets o ON o.id = s.outlet_id
       WHERE s.id = $1`,
      [id]
    );
    if (header.rowCount === 0) {
      return res.status(404).json({ error: 'Submission tidak ditemukan' });
    }

    const items = await query(
      `SELECT si.item_id, ci.label, si.checked, si.skipped, si.skip_reason
       FROM checklist_submission_items si
       JOIN checklist_items ci ON ci.id = si.item_id
       WHERE si.submission_id = $1
       ORDER BY ci.urutan, ci.id`,
      [id]
    );

    res.json({ ...header.rows[0], items: items.rows });
  } catch (err) {
    console.error('[submissions.detail]', err);
    res.status(500).json({ error: 'Gagal mengambil detail submission' });
  }
});

module.exports = router;
