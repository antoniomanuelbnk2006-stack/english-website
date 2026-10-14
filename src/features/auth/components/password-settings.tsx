'use client';

import { useEffect, useRef, useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import {
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  PASSWORD_SECTION_ID,
} from '@/features/auth/lib/password-rules';
import { CURRENT_PASSWORD_REQUIRED } from '@/features/auth/lib/recent-sign-in';
import { changePassword } from '@/features/auth/server/password-actions';
import type { ActionError } from '@/lib/actions';
import type { TranslationKey } from '@/lib/i18n';
import { useT } from '@/lib/i18n/client';

const ERRORS: Partial<Record<ActionError, TranslationKey>> = {
  invalid_input: 'passwordSettings.errorShort',
  unauthorized: 'passwordSettings.errorWrongCurrent',
  conflict: 'passwordSettings.errorSame',
  rate_limited: 'passwordSettings.errorLocked',
};

/**
 * Poner o cambiar la contraseña (ADR-0031). `needsCurrent`: si hay que escribir la actual, que es
 * siempre salvo justo después de entrar con el correo. `email` va oculto en el formulario para
 * que el gestor de contraseñas del navegador sepa de quién es la que guarda.
 */
export function PasswordSettings({
  email,
  needsCurrent,
}: {
  email: string;
  needsCurrent: boolean;
}) {
  const t = useT();
  const [askCurrent, setAskCurrent] = useState(needsCurrent);
  const [current, setCurrent] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<TranslationKey | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const first = useRef<HTMLInputElement>(null);

  // Llegando desde «¿Has olvidado la contraseña?», el foco va directo a escribirla.
  useEffect(() => {
    if (window.location.hash === `#${PASSWORD_SECTION_ID}`) first.current?.focus();
  }, []);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    if (askCurrent && current === '') return setError('passwordSettings.errorCurrentMissing');
    if (password.length < PASSWORD_MIN_LENGTH) return setError('passwordSettings.errorShort');
    if (password !== confirm) return setError('passwordSettings.errorMismatch');
    setError(null);
    startTransition(async () => {
      const result = await changePassword({
        current: askCurrent ? current : undefined,
        password,
        confirm,
      });
      if (result.ok) {
        setSaved(true);
        setCurrent('');
        setPassword('');
        setConfirm('');
        return;
      }
      if (result.message === CURRENT_PASSWORD_REQUIRED) {
        setAskCurrent(true);
        setError('passwordSettings.errorCurrentRequired');
        return;
      }
      setError(ERRORS[result.error] ?? 'passwordSettings.errorInternal');
    });
  }

  const describedBy = error ? 'password-settings-error' : undefined;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      <p className="text-body-sm text-muted">
        {t(askCurrent ? 'passwordSettings.withCurrent' : 'passwordSettings.withoutCurrent')}
      </p>
      <input type="email" name="email" autoComplete="username" value={email} readOnly hidden />
      {askCurrent ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="current-password">{t('passwordSettings.currentLabel')}</Label>
          <Input
            ref={first}
            id="current-password"
            name="current-password"
            type="password"
            autoComplete="current-password"
            maxLength={PASSWORD_MAX_LENGTH}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            aria-describedby={describedBy}
          />
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">{t('passwordSettings.newLabel')}</Label>
        <Input
          ref={askCurrent ? undefined : first}
          id="new-password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          aria-describedby={describedBy}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="confirm-password">{t('passwordSettings.confirmLabel')}</Label>
        <Input
          id="confirm-password"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          maxLength={PASSWORD_MAX_LENGTH}
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          aria-describedby={describedBy}
        />
      </div>
      <FieldError id="password-settings-error">{error ? t(error) : null}</FieldError>
      <p role="status" className="min-h-5 text-body-sm text-success">
        {saved ? t('passwordSettings.saved') : null}
      </p>
      <div>
        <Button
          type="submit"
          variant="secondary"
          disabled={pending || password === '' || confirm === ''}
        >
          {pending ? t('passwordSettings.saving') : t('passwordSettings.save')}
        </Button>
      </div>
    </form>
  );
}
