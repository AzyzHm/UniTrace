import { describe, it, expect } from 'vitest';
import { loadEnv } from '../../src/config/env.js';

const valid = { MONGODB_URI: 'mongodb://localhost:27017/test' };

describe('loadEnv', () => {
  it('applies defaults when optional values are missing', () => {
    const env = loadEnv(valid);
    expect(env.port).toBe(3000);
    expect(env.nodeEnv).toBe('development');
    expect(env.logLevel).toBe('info');
  });

  it('rejects an invalid port', () => {
    expect(() => loadEnv({ ...valid, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('rejects a missing MONGO_URI', () => {
    expect(() => loadEnv({})).toThrow(/MONGODB_URI/);
  });

  it('reports every problem at once', () => {
    expect(() => loadEnv({ PORT: 'abc' })).toThrow(/PORT[\s\S]*MONGODB_URI/);
  });

  it('defaults to the isamm email domains', () => {
    const env = loadEnv(valid);
    expect(env.allowedEmailDomains).toEqual(['isamm.uma.tn', 'isamm.u-manouba.tn']);
  });

  it('parses a custom domain list, trimmed and lowercased', () => {
    const env = loadEnv({ ...valid, ALLOWED_EMAIL_DOMAINS: ' Univ.DZ , other.edu ' });
    expect(env.allowedEmailDomains).toEqual(['univ.dz', 'other.edu']);
  });

  it('rejects an empty domain list, which would block every signup', () => {
    expect(() => loadEnv({ ...valid, ALLOWED_EMAIL_DOMAINS: '' })).toThrow(/ALLOWED_EMAIL_DOMAINS/);
  });
});

describe('agentmail config', () => {
  it('is optional outside production', () => {
    expect(loadEnv(valid).agentmail).toEqual({ apiKey: null, inboxId: null });
  });

  it('reads both values', () => {
    const env = loadEnv({
      ...valid,
      AGENTMAIL_API_KEY: 'am_test_key',
      AGENTMAIL_INBOX_ID: 'unitrace@agentmail.to',
    });
    expect(env.agentmail).toEqual({ apiKey: 'am_test_key', inboxId: 'unitrace@agentmail.to' });
  });

  it('treats a blank value as missing', () => {
    const env = loadEnv({ ...valid, AGENTMAIL_API_KEY: '', AGENTMAIL_INBOX_ID: '' });
    expect(env.agentmail).toEqual({ apiKey: null, inboxId: null });
  });

  it('is required in production, and reports both keys', () => {
    expect(() => loadEnv({ ...valid, NODE_ENV: 'production' })).toThrow(
      /AGENTMAIL_API_KEY[\s\S]*AGENTMAIL_INBOX_ID/,
    );
  });

  it('rejects an inbox id that is not an email address', () => {
    expect(() => loadEnv({ ...valid, AGENTMAIL_INBOX_ID: 'not-an-email' })).toThrow(
      /AGENTMAIL_INBOX_ID/,
    );
  });
});

describe('code hash secret', () => {
  const production = {
    ...valid,
    NODE_ENV: 'production',
    AGENTMAIL_API_KEY: 'am_test_key',
    AGENTMAIL_INBOX_ID: 'unitrace@agentmail.to',
    JWT_ACCESS_SECRET: 'j'.repeat(32),
  };

  it('falls back to a dev secret outside production', () => {
    expect(loadEnv(valid).codeHashSecret).toBeTruthy();
  });

  it('is required in production', () => {
    expect(() => loadEnv(production)).toThrow(/CODE_HASH_SECRET/);
  });

  it('must be at least 32 characters', () => {
    expect(() => loadEnv({ ...production, CODE_HASH_SECRET: 'too-short' })).toThrow(
      /CODE_HASH_SECRET/,
    );
  });

  it('accepts a strong secret in production', () => {
    const env = loadEnv({ ...production, CODE_HASH_SECRET: 'x'.repeat(32) });

    expect(env.codeHashSecret).toBe('x'.repeat(32));
  });
});

describe('jwt config', () => {
  const production = {
    ...valid,
    NODE_ENV: 'production',
    AGENTMAIL_API_KEY: 'am_test_key',
    AGENTMAIL_INBOX_ID: 'unitrace@agentmail.to',
    CODE_HASH_SECRET: 'x'.repeat(32),
  };

  it('falls back to a dev secret and a 15 minute lifetime outside production', () => {
    expect(loadEnv(valid).jwt).toEqual({
      accessSecret: expect.any(String),
      accessExpires: '15m',
    });
  });

  it('requires the secret in production', () => {
    expect(() => loadEnv(production)).toThrow(/JWT_ACCESS_SECRET/);
  });

  it('must be at least 32 characters', () => {
    expect(() => loadEnv({ ...production, JWT_ACCESS_SECRET: 'too-short' })).toThrow(
      /JWT_ACCESS_SECRET/,
    );
  });

  it('accepts a strong secret in production', () => {
    const env = loadEnv({ ...production, JWT_ACCESS_SECRET: 'j'.repeat(32) });

    expect(env.jwt.accessSecret).toBe('j'.repeat(32));
  });

  it('accepts a custom lifetime and treats a blank one as the default', () => {
    expect(loadEnv({ ...valid, JWT_ACCESS_EXPIRES: '30m' }).jwt.accessExpires).toBe('30m');
    expect(loadEnv({ ...valid, JWT_ACCESS_EXPIRES: '' }).jwt.accessExpires).toBe('15m');
  });

  it.each(['15', 'abc', '15 m', '-5m', '1.5h'])('rejects the lifetime "%s"', (lifetime) => {
    expect(() => loadEnv({ ...valid, JWT_ACCESS_EXPIRES: lifetime })).toThrow(/JWT_ACCESS_EXPIRES/);
  });
});
