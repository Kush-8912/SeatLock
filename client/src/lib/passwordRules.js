// Rules for a new password. The server checks the same three (auth.routes.js);
// the checklist under password fields shows them ticking off while you type.
export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'upper', label: 'One uppercase letter (A–Z)', test: (p) => /[A-Z]/.test(p) },
  { id: 'special', label: 'One special character (! @ # $ …)', test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

export const passwordMeetsRules = (p) => p.length <= 128 && PASSWORD_RULES.every((r) => r.test(p));
