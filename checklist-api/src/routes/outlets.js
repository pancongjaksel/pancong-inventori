const express = require('express');
const { query } = require('../db');
const adminAuth = require('../middleware/adminAuth');

const router = express.Router();

// GET /api/outlets — publik, cuma outlet aktif
router.get('/', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, nama, aktif FROM checklist_outlets WHERE aktif = true ORDER BY nama'
    );
    res.json(result.rows);
  } catch (err) {
    console.error('[outlets.get]', err);
    res.status(500).json({ error: 'Gagal mengambil data outlet' });
  }
});

// POST /api/outlets — admin, tambah outlet baru
router.post('/', adminAuth, async (req, res) => {
  const { nama } = req.body;
  if (!nama || !nama.trim()) {
    return res.status(400).json({ error: 'Nama outlet wajib diisi' });
  }
  try {
    const result = await query(
      'INSERT INTO checklist_outlets (nama) VALUES ($1) RETURNING id, nama, aktif',
      [nama.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('[outlets.post]', err);
    res.status(500).json({ error: 'Gagal menambah outlet' });
  }
});

// PUT /api/outlets/:id — admin, edit nama dan/atau nonaktifkan (soft delete)
router.put('/:id', adminAuth, async (req, res) => {
  const { id } = req.params;
  const { nama, aktif } = req.body;

  if (nama === undefined && aktif === undefined) {
    return res.status(400).json({ error: 'Tidak ada field untuk diupdate' });
  }

  const fields = [];
  const values = [];
  let idx = 1;

  if (nama !== undefined) {
    fields.push(`nama = $${idx++}`);
    values.push(nama.trim());
  }
  if (aktif !== undefined) {
    fields.push(`aktif = $${idx++}`);
    values.push(aktif);
  }
  values.push(id);

  try {
    const result = await query(
      `UPDATE checklist_outlets SET ${fields.join(', ')} WHERE id = $${idx} RETURNING id, nama, aktif`,
      values
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Outlet tidak ditemukan' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[outlets.put]', err);
    res.status(500).json({ error: 'Gagal update outlet' });
  }
});

module.exports = router;
