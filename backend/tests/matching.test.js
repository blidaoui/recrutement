import { describe, it, expect } from 'vitest';
import { calculerScoreMatching } from '../src/services/ia/matching.js';

describe('calculerScoreMatching', () => {
  describe('when the offer has no required skills', () => {
    const empty = { score: 0, skillsCommunes: [], skillsManquantes: [] };

    it('returns a zero score and empty lists for an empty array', () => {
      expect(calculerScoreMatching(['react', 'node'], [])).toEqual(empty);
    });

    it('returns a zero score and empty lists for null', () => {
      expect(calculerScoreMatching(['react', 'node'], null)).toEqual(empty);
    });

    it('returns a zero score and empty lists for undefined', () => {
      expect(calculerScoreMatching(['react', 'node'], undefined)).toEqual(empty);
    });
  });

  describe('base score (matched / required)', () => {
    it('gives 100 when the candidate has every required skill', () => {
      const result = calculerScoreMatching(['react', 'node', 'sql'], ['react', 'node', 'sql']);
      expect(result.score).toBe(100);
      expect(result.skillsCommunes).toEqual(['react', 'node', 'sql']);
      expect(result.skillsManquantes).toEqual([]);
    });

    it('gives 50 when the candidate has half of the required skills', () => {
      const result = calculerScoreMatching(
        ['react', 'node'],
        ['react', 'node', 'sql', 'docker']
      );
      expect(result.score).toBe(50);
      expect(result.skillsCommunes).toEqual(['react', 'node']);
      expect(result.skillsManquantes).toEqual(['sql', 'docker']);
    });

    it('rounds to two decimals (1 of 3 required skills = 33.33)', () => {
      const result = calculerScoreMatching(['react'], ['react', 'node', 'sql']);
      expect(result.score).toBe(33.33);
      expect(result.skillsManquantes).toEqual(['node', 'sql']);
    });

    it('gives 0 when the candidate has no skills at all', () => {
      const result = calculerScoreMatching([], ['react', 'node']);
      expect(result.score).toBe(0);
      expect(result.skillsCommunes).toEqual([]);
      expect(result.skillsManquantes).toEqual(['react', 'node']);
    });
  });

  describe('bonus for extra skills', () => {
    it('adds 2 points per extra skill', () => {
      // 2 of 4 required = 50, plus 2 extra skills (git, python) = +4
      const result = calculerScoreMatching(
        ['react', 'node', 'git', 'python'],
        ['react', 'node', 'sql', 'docker']
      );
      expect(result.score).toBe(54);
    });

    it('caps the bonus at 10 points', () => {
      // 2 of 4 required = 50, plus 6 extra skills (would be +12) capped at +10
      const result = calculerScoreMatching(
        ['react', 'node', 'git', 'python', 'java', 'docker', 'linux', 'typescript'],
        ['react', 'node', 'sql', 'mongodb']
      );
      expect(result.score).toBe(60);
    });

    it('never lets the final score exceed 100', () => {
      const result = calculerScoreMatching(
        ['react', 'git', 'python', 'java', 'docker', 'linux'],
        ['react']
      );
      expect(result.score).toBe(100);
    });
  });

  describe('skill comparison', () => {
    it('ignores case and keeps the offer spelling in the results', () => {
      const result = calculerScoreMatching(['react', 'NODE.JS'], ['React', 'Node.js']);
      expect(result.score).toBe(100);
      expect(result.skillsCommunes).toEqual(['React', 'Node.js']);
      expect(result.skillsManquantes).toEqual([]);
    });

    it('returns matched and missing skills in the order of the offer', () => {
      const result = calculerScoreMatching(['node', 'react'], ['sql', 'react', 'node']);
      expect(result.skillsCommunes).toEqual(['react', 'node']);
      expect(result.skillsManquantes).toEqual(['sql']);
      expect(result.score).toBe(66.67);
    });
  });

  describe('behaviours to decide on', () => {
    it('bonus applies even when no required skill matches', () => {
      const result = calculerScoreMatching(['git'], ['react', 'node']);
      expect(result.score).toBe(2);
    });

    it('does not count duplicate extra skills twice', () => {
      const result = calculerScoreMatching(['git', 'Git'], ['react', 'node']);
      expect(result.score).toBe(2);
    });

    it('handles null or undefined candidate skills list without throwing', () => {
      expect(calculerScoreMatching(null, ['react', 'node']).score).toBe(0);
      expect(calculerScoreMatching(undefined, ['react', 'node']).score).toBe(0);
    });
  });
});
