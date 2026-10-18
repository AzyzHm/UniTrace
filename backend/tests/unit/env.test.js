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
