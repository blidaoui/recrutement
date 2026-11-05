import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import { extractSkills } from '../src/services/ia/extractSkills.js';

const nodeRequire = createRequire(import.meta.url);
let realGenai;

// extractSkills.js loads '@google/genai' with require(), so we swap the
// module in Node's require cache instead of using vi.mock.
function useFakeGemini(generateContent) {
  const path = nodeRequire.resolve('@google/genai');
  realGenai = realGenai ?? { path, exports: nodeRequire(path) };
  nodeRequire.cache[path].exports = {
    GoogleGenAI: class {
      constructor() {
        this.models = { generateContent };
      }
    },
  };
}
  describe('empty input', () => {
    beforeEach(() => {
      delete process.env.GEMINI_API_KEY;
    });

    it('returns [] for an empty string', async () => {
      expect(await extractSkills('')).toEqual([]);
    });

    it('returns [] for a string with only spaces', async () => {
      expect(await extractSkills('   \n  ')).toEqual([]);
    });

    it('returns [] for null', async () => {
      expect(await extractSkills(null)).toEqual([]);
    });

    it('returns [] for undefined', async () => {
      expect(await extractSkills(undefined)).toEqual([]);
    });
  });

describe('extractSkills with a Gemini key (mocked client)', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', 'test-key');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    if (realGenai) nodeRequire.cache[realGenai.path].exports = realGenai.exports;
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns the skills given by Gemini', async () => {
    const generate = vi.fn().mockResolvedValue({ text: '["React.js","Plomberie"]' });
    useFakeGemini(generate);
    const skills = await extractSkills('Some CV text');
    expect(skills).toEqual(['React.js', 'Plomberie']);
    expect(generate).toHaveBeenCalledTimes(1);
  });

  it('falls back to the local reference when Gemini throws', async () => {
    const generate = vi.fn().mockRejectedValue(new Error('network down'));
    useFakeGemini(generate);
    const skills = await extractSkills('Developer with Python experience');
    expect(skills).toContain('Python');
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('falls back when Gemini returns text that is not valid JSON', async () => {
    const generate = vi.fn().mockResolvedValue({ text: 'not json at all' });
    useFakeGemini(generate);
    const skills = await extractSkills('Developer with Python experience');
    expect(skills).toContain('Python');
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  it('falls back when Gemini returns JSON that is not an array', async () => {
    const generate = vi.fn().mockResolvedValue({ text: '{"skills":["Python"]}' });
    useFakeGemini(generate);
    const skills = await extractSkills('Developer with Python experience');
    expect(skills).toContain('Python');
  });

  it('sends at most 8000 characters of the CV to Gemini', async () => {
    const generate = vi.fn().mockResolvedValue({ text: '[]' });
    useFakeGemini(generate);
    await extractSkills('a'.repeat(9000));
    const prompt = generate.mock.calls[0][0].contents;
    expect(prompt).toContain('a'.repeat(8000));
    expect(prompt).not.toContain('a'.repeat(8001));
  });

  it('does not call Gemini for empty text', async () => {
    const generate = vi.fn();
    useFakeGemini(generate);
    expect(await extractSkills('   ')).toEqual([]);
    expect(generate).not.toHaveBeenCalled();
  });

  it('does not call Gemini when the key is missing', async () => {
    vi.stubEnv('GEMINI_API_KEY', '');
    const generate = vi.fn();
    useFakeGemini(generate);
    const skills = await extractSkills('Python developer');
    expect(skills).toContain('Python');
    expect(generate).not.toHaveBeenCalled();
  });
});