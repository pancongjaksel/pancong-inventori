const { pool } = require('../db/pool');
const {periodBounds,rowsToPayload}=require('../utils/dashboardHppTopping');

async function buildDashboardHppTopping(period){
  const {start,nextMonth}=periodBounds(period);
  const {rows}=await pool.query(
    `SELECT
       o.nama AS outlet_name,
       COUNT(DISTINCT sp.id) FILTER (WHERE i.id IS NOT NULL) AS transaction_count,
       COUNT(DISTINCT i.id) FILTER (WHERE si.id IS NOT NULL AND i.harga <= 0) AS missing_cost_count,
       COALESCE(SUM(si.qty * i.harga) FILTER (WHERE i.harga > 0), 0) AS amount
     FROM outlet o
     LEFT JOIN sesi_pengambilan_crew sp
       ON sp.outlet_tujuan_id = o.id
      AND sp.tanggal >= $1::date
      AND sp.tanggal < $2::date
      AND COALESCE(sp.label_status, 'normal') != 'Dikoreksi'
     LEFT JOIN sesi_pengambilan_item si ON si.sesi_id = sp.id
     LEFT JOIN item i ON i.id = si.item_id AND i.kategori = 'Topping'
     WHERE o.aktif = true
     GROUP BY o.id, o.nama
     ORDER BY o.nama`,
    [start,nextMonth]
  );
  return rowsToPayload(period,rows);
}

module.exports={buildDashboardHppTopping};
