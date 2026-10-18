import { createHash, randomBytes } from 'node:crypto';

const TOKEN_BYTES = 32;

export function createRefreshTokenHasher({ random = randomBytes } = {}) {
  return {
    // 256 random bits, as 43 URL-safe characters, which is cookie-safe as is.
    generate() {
      return random(TOKEN_BYTES).toString('base64url');
    },

    // Plain SHA-256 is enough here. A password needs a slow, salted hash
    // because people choose weak ones. This token is 256 random bits, so it
    // cannot be guessed, and a deterministic hash lets us find it by lookup.
    hash(token) {
      return createHash('sha256').update(token).digest('hex');
    },
  };
}
