// Example: Unit Test for Utilities
// Location: apps/server/test/unit/matchers.test.ts

import { describe, it, expect } from 'vitest';

describe('Custom Matchers', () => {
  describe('toBeNil', () => {
    it('should pass when value is null', () => {
      expect(null).toBeNil();
    });

    it('should pass when value is undefined', () => {
      expect(undefined).toBeNil();
    });

    it('should fail when value is defined', () => {
      expect(() => expect('hello').toBeNil()).toThrow();
      expect(() => expect(0).toBeNil()).toThrow();
      expect(() => expect(false).toBeNil()).toThrow();
      expect(() => expect('').toBeNil()).toThrow();
    });

    it('should work with .not modifier for null', () => {
      expect(() => expect(null).not.toBeNil()).toThrow();
    });

    it('should work with .not modifier for undefined', () => {
      expect(() => expect(undefined).not.toBeNil()).toThrow();
    });

    it('should pass with .not when value is defined', () => {
      expect('hello').not.toBeNil();
      expect(0).not.toBeNil();
      expect(false).not.toBeNil();
      expect('').not.toBeNil();
      expect({}).not.toBeNil();
      expect([]).not.toBeNil();
    });
  });
});

// Example: Testing Pure Utility Functions

describe('String Utilities', () => {
  function capitalize(str: string): string {
    if (!str) return str;
    return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  }

  describe('capitalize', () => {
    it('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('world')).toBe('World');
    });

    it('should handle empty string', () => {
      expect(capitalize('')).toBe('');
    });

    it('should handle single character', () => {
      expect(capitalize('a')).toBe('A');
    });

    it('should lowercase rest of string', () => {
      expect(capitalize('hELLO')).toBe('Hello');
      expect(capitalize('WORLD')).toBe('World');
    });
  });
});

// Example: Testing Type Guards

describe('Type Guards', () => {
  function isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  describe('isString', () => {
    it('should return true for strings', () => {
      expect(isString('hello')).toBe(true);
      expect(isString('')).toBe(true);
      expect(isString('123')).toBe(true);
    });

    it('should return false for non-strings', () => {
      expect(isString(123)).toBe(false);
      expect(isString(null)).toBe(false);
      expect(isString(undefined)).toBe(false);
      expect(isString({})).toBe(false);
      expect(isString([])).toBe(false);
      expect(isString(true)).toBe(false);
    });
  });
});

// Example: Testing Array Utilities

describe('Array Utilities', () => {
  function groupBy<T>(
    array: T[],
    key: keyof T
  ): Record<string, T[]> {
    return array.reduce((result, item) => {
      const groupKey = String(item[key]);
      if (!result[groupKey]) {
        result[groupKey] = [];
      }
      result[groupKey].push(item);
      return result;
    }, {} as Record<string, T[]>);
  }

  describe('groupBy', () => {
    it('should group array by key', () => {
      const items = [
        { type: 'A', value: 1 },
        { type: 'B', value: 2 },
        { type: 'A', value: 3 },
      ];

      const result = groupBy(items, 'type');

      expect(result.A).toHaveLength(2);
      expect(result.B).toHaveLength(1);
      expect(result.A[0].value).toBe(1);
      expect(result.A[1].value).toBe(3);
    });

    it('should handle empty array', () => {
      expect(groupBy([], 'key')).toEqual({});
    });

    it('should handle single item', () => {
      const items = [{ type: 'A', value: 1 }];
      const result = groupBy(items, 'type');

      expect(result.A).toHaveLength(1);
      expect(result.A[0].value).toBe(1);
    });
  });
});
