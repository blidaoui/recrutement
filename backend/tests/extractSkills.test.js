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

describe('extractSkills without a Gemini key (local fallback)', () => {
  beforeEach(() => {
    vi.stubEnv('GEMINI_API_KEY', '');
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns an empty list for empty, blank, null or undefined text', async () => {
    expect(await extractSkills('')).toEqual([]);
    expect(await extractSkills('   \n  ')).toEqual([]);
    expect(await extractSkills(null)).toEqual([]);
    expect(await extractSkills(undefined)).toEqual([]);
  });

  it('returns an empty list when no known skill is mentioned', async () => {
    expect(await extractSkills('zzqx kwpv fjrt')).toEqual([]);
  });

  it('detects a skill through its synonyms', async () => {
    const skills = await extractSkills('Frontend developer using JS and ReactJS');
    expect(skills).toContain('JavaScript');
    expect(skills).toContain('React');
  });

  it('ignores case', async () => {
    const skills = await extractSkills('PYTHON and DJANGO');
    expect(skills).toContain('Python');
    expect(skills).toContain('Django');
  });

  it('does not detect Java inside JavaScript', async () => {
    const skills = await extractSkills('Senior JavaScript developer');
    expect(skills).toContain('JavaScript');
    expect(skills).not.toContain('Java');
  });

  it('does not treat the everyday word "go" as the Go language', async () => {
    const skills = await extractSkills('I like to go to Google events');
    expect(skills).not.toContain('Go');
  });

  it('detects C++ when it is followed by a space', async () => {
    const skills = await extractSkills('Strong knowledge of C++ and databases');
    expect(skills).toContain('C++');
  });

  it('detects C# when it is followed by a space', async () => {
    const skills = await extractSkills('Backend services written in C# and SQL');
    expect(skills).toContain('C#');
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