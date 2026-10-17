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
