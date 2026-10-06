import { describe, it, expect } from 'vitest';
import { PASSWORD_RULES, passwordMeetsRules } from './passwordRules';

const failing = (p) => PASSWORD_RULES.filter((r) => !r.test(p)).map((r) => r.id);

describe('password rules', () => {
  it('names each rule a password still misses', () => {
    expect(failing('')).toEqual(['length', 'upper', 'special']);
    expect(failing('abcdefgh')).toEqual(['upper', 'special']);
    expect(failing('Abcdefgh')).toEqual(['special']);
    expect(failing('Abc!')).toEqual(['length']);
  });

  it('does not count spaces as special characters', () => {
    expect(failing('Has Spaces Here')).toEqual(['special']);
  });

  it('accepts a password that meets every rule', () => {
    expect(passwordMeetsRules('Seat-Lock9')).toBe(true);
    expect(passwordMeetsRules('seat-lock9')).toBe(false);
    expect(passwordMeetsRules(`A!${'x'.repeat(127)}`)).toBe(false); // over the 128 limit
  });
});
