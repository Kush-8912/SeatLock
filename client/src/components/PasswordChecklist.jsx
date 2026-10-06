import { Check, X } from 'lucide-react';
import { PASSWORD_RULES } from '../lib/passwordRules';

/**
 * Live checklist under a new-password field. Each rule turns green the moment
 * it's met; after a submit attempt, rules still unmet turn red.
 */
export function PasswordChecklist({ password, showErrors = false, id }) {
  return (
    <ul id={id} className="mt-2.5 space-y-1.5" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        const failed = !met && showErrors;
        return (
          <li key={rule.id} className={`flex items-center gap-2 text-xs transition-colors ${met ? 'text-go' : failed ? 'text-stop' : 'text-muted'}`}>
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                met ? 'border-go bg-go text-ink' : failed ? 'border-stop text-stop' : 'border-line-strong'
              }`}
              aria-hidden
            >
              {met ? <Check className="h-3 w-3" strokeWidth={3} /> : failed ? <X className="h-3 w-3" strokeWidth={3} /> : null}
            </span>
            {rule.label}
            <span className="sr-only">{met ? '(done)' : '(not yet)'}</span>
          </li>
        );
      })}
    </ul>
  );
}
