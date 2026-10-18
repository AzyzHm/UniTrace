import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { CODE_LENGTH } from '../constants/verification-code.js';

const CODE_SPACE = 10 ** CODE_LENGTH;

export function createCodeHasher({ secret, random = randomInt }) {
  if (!secret) {
    throw new Error('createCodeHasher(): secret is required');
  }

  // Bound to the user and the purpose, so a hash copied from one document
  // is useless in another one.
  function hash(code, { userId, purpose }) {
    return createHmac('sha256', secret).update(`${userId}:${purpose}:${code}`).digest('hex');
  }

  return {
    // padStart keeps leading zeros: 42 becomes "000042", not "42".
    generate() {
      return String(random(CODE_SPACE)).padStart(CODE_LENGTH, '0');
    },

    hash,

    matches(code, storedHash, context) {
      const expected = Buffer.from(storedHash, 'hex');
      const actual = Buffer.from(hash(code, context), 'hex');

      // timingSafeEqual throws on different lengths, and a malformed stored
      // hash must simply not match.
      return expected.length === actual.length && timingSafeEqual(expected, actual);
    },
  };
}
