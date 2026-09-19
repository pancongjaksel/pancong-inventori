const crypto = require('crypto');
const { pool } = require('../db/pool');

function hashRequest(body) {
  return crypto.createHash('sha256').update(JSON.stringify(body ?? {})).digest('hex');
}

async function beginIdempotent(client, { key, actorType, actorId, endpoint, body }) {
  if (!key) return { duplicate: false, hash: null };
  const requestHash = hashRequest(body);
  const { rows } = await client.query(
    `SELECT request_hash, response_status, response_body
       FROM api_idempotency
      WHERE actor_type = $1 AND actor_id = $2 AND endpoint = $3 AND idempotency_key = $4
      FOR UPDATE`,
    [actorType, String(actorId), endpoint, key],
  );
  if (rows.length && rows[0].request_hash !== requestHash) {
    const err = new Error('Idempotency-Key sudah dipakai dengan payload berbeda.');
    err.status = 409;
    err.code = 'IDEMPOTENCY_PAYLOAD_BERBEDA';
    throw err;
  }
  if (rows.length && rows[0].response_body) return { duplicate: true, ...rows[0] };
  if (!rows.length) {
    await client.query(
      `INSERT INTO api_idempotency (idempotency_key, actor_type, actor_id, endpoint, request_hash)
       VALUES ($1,$2,$3,$4,$5)`,
      [key, actorType, String(actorId), endpoint, requestHash],
    );
  }
  return { duplicate: false, hash: requestHash };
}

async function finishIdempotent(client, { key, actorType, actorId, endpoint, status, body }) {
  if (!key) return;
  await client.query(
    `UPDATE api_idempotency
        SET response_status = $1, response_body = $2
      WHERE actor_type = $3 AND actor_id = $4 AND endpoint = $5 AND idempotency_key = $6`,
    [status, JSON.stringify(body), actorType, String(actorId), endpoint, key],
  );
}

module.exports = { pool, hashRequest, beginIdempotent, finishIdempotent };
