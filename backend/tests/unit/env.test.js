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
});
