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
