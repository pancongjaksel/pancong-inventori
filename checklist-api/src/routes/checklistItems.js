const express = require('express');
const { query } = require('../db');
const crewAuth = require('../middleware/crewAuth');

const router = express.Router();

const VALID_TYPES = ['opening', 'closing'];

// GET /api/checklist-items?outlet_id=&type= — publik
router.get('/', async (req, res) => {
  const { outlet_id, type } = req.query;
  if (!outlet_id || !type) {
    return res.status(400).json({ error: 'outlet_id dan type wajib diisi' });
  }
  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({ error: 'type harus opening atau closing' });
  }
  try {
    const result = await query(
      `SELECT id, outlet_id, tipe, label, urutan
       FROM checklist_items
       WHERE outlet_id = $1 AND tipe = $2 AND aktif = true
       ORDER BY urutan, id`,
      [outlet_id, type]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[checklistItems.get]', err);
    res.status(500).json({ error: 'Gagal mengambil checklist items' });
  }
});

// POST /api/checklist-items — crew/spv (butuh x-crew-key), tambah item baru
router.post('/', crewAuth, async (req, res) => {
  const { outlet_id, tipe, label, urutan } = req.body;
  if (!outlet_id || !tipe || !label || !label.trim()) {
    return res.status(400).json({ error: 'outlet_id, tipe, dan label wajib diisi' });
  }
  if (!VALID_TYPES.includes(tipe)) {
    return res.status(400).json({ error: 'tipe harus opening atau closing' });
  }
  try {
    const result = await query(
      `INSERT INTO checklist_items (outlet_id, tipe, label, urutan)
       VALUES ($1, $2, $3, COALESCE($4, 0))
       RETURNING id, outlet_id, tipe, label, urutan, aktif`,
      [outlet_id, tipe, label.trim(), urutan ?? null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[checklistItems.post]', err);
    res.status(500).json({ error: 'Gagal menambah checklist item' });
  }
});

// PUT /api/checklist-items/:id — crew/spv (butuh x-crew-key), edit label/urutan/aktif (soft delete)
router.put('/:id', crewAuth, async (req, res) => {
  const { id } = req.params;
  const { label, urutan, aktif } = req.body;

  if (label === undefined && urutan === undefined && aktif === undefined) {
    return res.status(400).json({ error: 'Tidak ada field untuk diupdate' });
  }

  const fields = [];
  const values = [];
  let idx = 1;

  if (label !== undefined) {
    fields.push(`label = $${idx++}`);
    values.push(label.trim());
  }
  if (urutan !== undefined) {
    fields.push(`urutan = $${idx++}`);
    values.push(urutan);
  }
  if (aktif !== undefined) {
    fields.push(`aktif = $${idx++}`);
    values.push(aktif);
  }
  values.push(id);

  try {
    const result = await query(
      `UPDATE checklist_items SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, outlet_id, tipe, label, urutan, aktif`,
      values
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Item tidak ditemukan' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[checklistItems.put]', err);
    res.status(500).json({ error: 'Gagal update checklist item' });
  }
});

module.exports = router;
