import { describe, it, expect } from 'vitest';

describe('setup', () => {
  it('uses the test environment and test database', () => {
    expect(process.env.NODE_ENV).toBe('test');
    expect(process.env.DATABASE_URL).toContain('recrutement_ia_test');
  });
});