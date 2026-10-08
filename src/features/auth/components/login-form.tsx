'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { requestOtp, verifyOtp } from '@/features/auth/server/actions';
import type { ActionError } from '@/lib/actions';
import { useT } from '@/lib/i18n/client';
import type { TranslationKey } from '@/lib/i18n';

const EMAIL_ERRORS: Partial<Record<ActionError, TranslationKey>> = {
  invalid_input: 'login.errorInvalidEmail',
  rate_limited: 'login.errorRateLimited',
};

const CODE_ERRORS: Partial<Record<ActionError, TranslationKey>> = {
  invalid_input: 'login.errorInvalidCode',
  unauthorized: 'login.errorWrongCode',
  rate_limited: 'login.errorRateLimited',
};

export function LoginForm() {
  const t = useT();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<TranslationKey | null>(null);
  const [pending, startTransition] = useTransition();

  function handleEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await requestOtp({ email });
      if (result.ok) {
        setSentTo(result.data.email);
        setCode('');
      } else {
        setError(EMAIL_ERRORS[result.error] ?? 'login.errorInternal');
      }
    });
  }

  function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sentTo) return;
    setError(null);
    startTransition(async () => {
      // Si el código es correcto, la acción redirige a /hoy y nunca devuelve un resultado.
      const result = await verifyOtp({ email: sentTo, token: code });
      if (!result.ok) setError(CODE_ERRORS[result.error] ?? 'login.errorInternal');
    });
  }

  if (sentTo === null) {
    return (
      <form onSubmit={handleEmail} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-2">
          <Label htmlFor="email">{t('login.emailLabel')}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            required
            autoFocus
            placeholder={t('login.emailPlaceholder')}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'email-error' : undefined}
          />
          <FieldError id="email-error">{error ? t(error) : null}</FieldError>
        </div>
        <Button type="submit" size="lg" disabled={pending || email.trim() === ''}>
          {pending ? t('login.sending') : t('login.sendCode')}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={handleCode} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted" role="status">
        {t('login.codeSent', { email: sentTo })}
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">{t('login.codeLabel')}</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="\d{6}"
          required
          autoFocus
          className="hud h-14 text-center text-2xl tracking-[0.5em]"
          value={code}
          // Sin maxLength: al pegar «123 456» el navegador cortaría antes de quitar el espacio.
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'code-error' : undefined}
        />
        <FieldError id="code-error">{error ? t(error) : null}</FieldError>
      </div>
      <Button type="submit" size="lg" disabled={pending || code.length !== 6}>
        {pending ? t('login.verifying') : t('login.verify')}
      </Button>
      <Button
        variant="ghost"
        disabled={pending}
        onClick={() => {
          setSentTo(null);
          setError(null);
        }}
      >
        {t('login.changeEmail')}
      </Button>
    </form>
  );
}
