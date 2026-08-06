const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifikasiPassword } = require('../../utils/passwordHash');

describe('passwordHash', () => {
  test('password yang benar cocok dengan hash-nya', async () => {
    const hash = await hashPassword('password-kuat-123');
    const cocok = await verifikasiPassword('password-kuat-123', hash);
    assert.equal(cocok, true);
  });

  test('password yang salah gak cocok', async () => {
    const hash = await hashPassword('password-benar');
    const cocok = await verifikasiPassword('password-salah', hash);
    assert.equal(cocok, false);
  });

  test('hash gak pernah menyimpan plaintext password (harus beda string)', async () => {
    const hash = await hashPassword('rahasia123');
    assert.notEqual(hash, 'rahasia123');
    assert.ok(hash.startsWith('$2')); // format bcrypt hash
  });
});
