import { ProgressEngine } from './ProgressEngine';
import { describe, it, expect } from 'vitest';

describe('ProgressEngine', () => {
  describe('testCalculation', () => {
    it('should return 0 for empty logs', () => {
      expect(ProgressEngine.testCalculation([], [])).toBe(0);
    });

    it('should return 100 for all completed logs', () => {
      expect(ProgressEngine.testCalculation([true, true, true], [1, 1, 1])).toBe(100);
    });

    it('should return 50 for half completed logs', () => {
      expect(ProgressEngine.testCalculation([true, false], [1, 1])).toBe(50);
    });

    it('should return 33 for 1/3 completed logs', () => {
      expect(ProgressEngine.testCalculation([true, false, false], [1, 1, 1])).toBe(33);
    });
  });
});
