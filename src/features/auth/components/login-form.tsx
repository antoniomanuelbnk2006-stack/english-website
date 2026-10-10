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
  // Aquí el límite es el de correos enviados, que no se levanta en un minuto.
  rate_limited: 'login.errorEmailRateLimited',
};

const CODE_ERRORS: Partial<Record<ActionError, TranslationKey>> = {
  invalid_input: 'login.errorInvalidCode',
  unauthorized: 'login.errorWrongCode',
  rate_limited: 'login.errorRateLimited',
};

const FIXED_CODE_ERRORS: Partial<Record<ActionError, TranslationKey>> = {
  invalid_input: 'login.errorInvalidFixedCode',
  unauthorized: 'login.errorWrongFixedCode',
  rate_limited: 'login.errorRateLimited',
};

/** Cifras del código que llega por correo y de un código fijo (ADR-0020). */
const EMAIL_CODE_LENGTH = 6;
const FIXED_CODE_MIN = 4;
const FIXED_CODE_MAX = 8;

export function LoginForm({ fixedCode = false }: { fixedCode?: boolean }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  /** Con código fijo no se pide ningún correo: se pasa directamente a escribirlo. */
  const [fixed, setFixed] = useState(false);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [pending, startTransition] = useTransition();

  function requestEmail() {
    setError(null);
    startTransition(async () => {
      const result = await requestOtp({ email });
      if (result.ok) {
        setFixed(false);
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
      if (!result.ok) {
        const errors = fixed ? FIXED_CODE_ERRORS : CODE_ERRORS;
        setError(errors[result.error] ?? 'login.errorInternal');
      }
    });
  }

  function enterFixedCode() {
    const address = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError('login.errorInvalidEmail');
      return;
    }
    setError(null);
    setFixed(true);
    setSentTo(address);
    setCode('');
  }

  function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Con código fijo, lo principal (y lo que hace Intro) es pasar a escribirlo: el correo queda
    // como respaldo (ADR-0021).
    if (fixedCode) enterFixedCode();
    else requestEmail();
  }

  if (sentTo === null) {
    return (
      <form onSubmit={handleStart} className="flex flex-col gap-4" noValidate>
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
        {fixedCode ? (
          <>
            <Button type="submit" size="lg" disabled={pending || email.trim() === ''}>
              {t('login.fixedCodeButton')}
            </Button>
            <Button
              variant="secondary"
              size="lg"
              disabled={pending || email.trim() === ''}
              onClick={requestEmail}
            >
              {pending ? t('login.sending') : t('login.sendEmail')}
            </Button>
          </>
        ) : (
          <Button type="submit" size="lg" disabled={pending || email.trim() === ''}>
            {pending ? t('login.sending') : t('login.sendEmail')}
          </Button>
        )}
      </form>
    );
  }

  return (
    <form onSubmit={handleCode} className="flex flex-col gap-4" noValidate>
      <p className="text-sm text-muted" role="status">
        {fixed
          ? t('login.fixedCodePrompt', { email: sentTo })
          : t('login.codeSent', { email: sentTo })}
      </p>
      <div className="flex flex-col gap-2">
        <Label htmlFor="code">{t(fixed ? 'login.fixedCodeLabel' : 'login.codeLabel')}</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern={fixed ? `\\d{${FIXED_CODE_MIN},${FIXED_CODE_MAX}}` : '\\d{6}'}
          required
          autoFocus
          className="hud h-14 text-center text-2xl tracking-[0.5em]"
          value={code}
          // Sin maxLength: al pegar «123 456» el navegador cortaría antes de quitar el espacio.
          onChange={(e) =>
            setCode(
              e.target.value
                .replace(/\D/g, '')
                .slice(0, fixed ? FIXED_CODE_MAX : EMAIL_CODE_LENGTH),
            )
          }
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'code-error' : undefined}
        />
        <FieldError id="code-error">{error ? t(error) : null}</FieldError>
      </div>
      <Button
        type="submit"
        size="lg"
        disabled={
          pending || (fixed ? code.length < FIXED_CODE_MIN : code.length !== EMAIL_CODE_LENGTH)
        }
      >
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
