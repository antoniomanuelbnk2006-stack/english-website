'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { FieldError, Input, Label } from '@/components/ui/input';
import { lockWait } from '@/features/auth/lib/lockout';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '@/features/auth/lib/password-rules';
import { requestOtp, signInWithPassword, verifyOtp } from '@/features/auth/server/actions';
import type { ActionError } from '@/lib/actions';
import { PRIVACY_POLICY_URL } from '@/lib/consent';
import { useT } from '@/lib/i18n/client';
import type { TranslationKey, TranslationVars } from '@/lib/i18n';

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

const PASSWORD_ERRORS: Partial<Record<ActionError, TranslationKey>> = {
  invalid_input: 'login.errorInvalidPassword',
  unauthorized: 'login.errorWrongPassword',
  rate_limited: 'login.errorRateLimited',
};

/** Cifras del código que llega por correo. */
const EMAIL_CODE_LENGTH = 6;

interface FormError {
  key: TranslationKey;
  vars?: TranslationVars;
}

/** El aviso de acceso cerrado por intentos fallidos (ADR-0024), con lo que falta. */
function lockedError(retryAfterSeconds: number): FormError {
  const wait = lockWait(retryAfterSeconds);
  return {
    key: wait.unit === 'hours' ? 'login.errorLockedHours' : 'login.errorLockedMinutes',
    vars: { n: wait.n },
  };
}

/** `withPassword`: el servidor admite entrar con contraseña (ADR-0026); si no, solo con el correo. */
export function LoginForm({ withPassword = false }: { withPassword?: boolean }) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [secret, setSecret] = useState('');
  /** Con contraseña no se pide ningún correo: se pasa directamente a escribirla. */
  const [typingPassword, setTypingPassword] = useState(false);
  /** El correo se ha pedido por haber olvidado la contraseña (ADR-0031). */
  const [forgot, setForgot] = useState(false);
  const [error, setError] = useState<FormError | null>(null);
  /** La política de privacidad se acepta en cada acceso (ADR-0030): la casilla empieza sin marcar. */
  const [privacy, setPrivacy] = useState(false);
  const [privacyMissing, setPrivacyMissing] = useState(false);
  const [pending, startTransition] = useTransition();

  /** Lo que devuelve una acción de acceso cuando no entra (si entra, redirige y no devuelve). */
  function showFailure(
    result: { error: ActionError; retryAfterSeconds?: number },
    errors: Partial<Record<ActionError, TranslationKey>>,
  ) {
    setError(
      result.retryAfterSeconds === undefined
        ? { key: errors[result.error] ?? 'login.errorInternal' }
        : lockedError(result.retryAfterSeconds),
    );
  }

  /** Sin aceptar la política de privacidad no se entra: se avisa junto a la casilla. */
  function privacyAccepted(): boolean {
    setPrivacyMissing(!privacy);
    return privacy;
  }

  function requestEmail() {
    setError(null);
    if (!privacyAccepted()) return;
    startTransition(async () => {
      const result = await requestOtp({ email, privacy });
      if (result.ok) {
        setTypingPassword(false);
        setForgot(false);
        setSentTo(result.data.email);
        setCode('');
      } else {
        setError({ key: EMAIL_ERRORS[result.error] ?? 'login.errorInternal' });
      }
    });
  }

  /** Pide el correo de siempre; al entrar con él se va a Ajustes a poner una nueva (ADR-0031). */
  function forgotPassword() {
    if (!sentTo) return;
    setError(null);
    startTransition(async () => {
      const result = await requestOtp({ email: sentTo, privacy, forgotPassword: true });
      if (result.ok) {
        setTypingPassword(false);
        setForgot(true);
        setSentTo(result.data.email);
        setCode('');
      } else {
        setError({ key: EMAIL_ERRORS[result.error] ?? 'login.errorInternal' });
      }
    });
  }

  function handleCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sentTo) return;
    setError(null);
    startTransition(async () => {
      const result = await verifyOtp({ email: sentTo, token: code, privacy });
      if (!result.ok) showFailure(result, CODE_ERRORS);
    });
  }

  function handlePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sentTo) return;
    // Una contraseña más corta que el mínimo no puede ser la buena: ni se envía.
    if (secret.length < PASSWORD_MIN_LENGTH) {
      setError({ key: 'login.errorInvalidPassword' });
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await signInWithPassword({ email: sentTo, password: secret, privacy });
      if (!result.ok) showFailure(result, PASSWORD_ERRORS);
    });
  }

  function typePassword() {
    const address = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(address)) {
      setError({ key: 'login.errorInvalidEmail' });
      return;
    }
    setError(null);
    if (!privacyAccepted()) return;
    setTypingPassword(true);
    setSentTo(address);
    setSecret('');
  }

  function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Con contraseña, lo principal (y lo que hace Intro) es pasar a escribirla: el correo queda
    // como respaldo (ADR-0021).
    if (withPassword) typePassword();
    else requestEmail();
  }

  const changeEmail = (
    <Button
      variant="ghost"
      disabled={pending}
      onClick={() => {
        setSentTo(null);
        setSecret('');
        setError(null);
      }}
    >
      {t('login.changeEmail')}
    </Button>
  );

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
            // «username» es lo que busca el gestor de contraseñas del navegador.
            autoComplete={withPassword ? 'username' : 'email'}
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
          <FieldError id="email-error">{error ? t(error.key, error.vars) : null}</FieldError>
        </div>
        <div className="flex flex-col gap-2">
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-body-sm">
            <input
              type="checkbox"
              name="privacy"
              className="size-4 shrink-0 accent-accent"
              checked={privacy}
              onChange={(e) => {
                setPrivacy(e.target.checked);
                setPrivacyMissing(false);
              }}
              aria-invalid={privacyMissing ? true : undefined}
              aria-describedby={privacyMissing ? 'privacy-error' : undefined}
            />
            <span>
              {t('login.privacyAccept')}{' '}
              <a
                href={PRIVACY_POLICY_URL}
                className="text-accent-text underline underline-offset-4"
              >
                {t('login.privacyLink')}
              </a>
            </span>
          </label>
          <FieldError id="privacy-error">
            {privacyMissing ? t('login.errorPrivacy') : null}
          </FieldError>
        </div>
        {withPassword ? (
          <>
            <Button type="submit" size="lg" disabled={pending || email.trim() === ''}>
              {t('login.passwordButton')}
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

  if (typingPassword) {
    return (
      <form onSubmit={handlePassword} className="flex flex-col gap-4" noValidate>
        <p className="text-body-sm text-muted" role="status">
          {t('login.passwordPrompt', { email: sentTo })}
        </p>
        {/* El email va en el mismo formulario, aunque no se vea: así el gestor de contraseñas
            del navegador sabe de quién es la contraseña que guarda o rellena. */}
        <input type="email" name="email" autoComplete="username" value={sentTo} readOnly hidden />
        <div className="flex flex-col gap-2">
          <Label htmlFor="password">{t('login.passwordLabel')}</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            autoCapitalize="none"
            spellCheck={false}
            required
            autoFocus
            maxLength={PASSWORD_MAX_LENGTH}
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'password-error' : undefined}
          />
          <FieldError id="password-error">{error ? t(error.key, error.vars) : null}</FieldError>
        </div>
        <Button type="submit" size="lg" disabled={pending || secret === ''}>
          {pending ? t('login.verifying') : t('login.verify')}
        </Button>
        <Button variant="ghost" disabled={pending} onClick={forgotPassword}>
          {t('login.forgotPassword')}
        </Button>
        {changeEmail}
      </form>
    );
  }

  return (
    <form onSubmit={handleCode} className="flex flex-col gap-4" noValidate>
      <p className="text-body-sm text-muted" role="status">
        {t('login.codeSent', { email: sentTo })}
        {forgot ? ` ${t('login.forgotSent')}` : null}
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
          className="tabular-nums h-14 text-center text-heading-sm tracking-[0.5em]"
          value={code}
          // Sin maxLength: al pegar «123 456» el navegador cortaría antes de quitar el espacio.
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, EMAIL_CODE_LENGTH))}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'code-error' : undefined}
        />
        <FieldError id="code-error">{error ? t(error.key, error.vars) : null}</FieldError>
      </div>
      <Button type="submit" size="lg" disabled={pending || code.length !== EMAIL_CODE_LENGTH}>
        {pending ? t('login.verifying') : t('login.verify')}
      </Button>
      {changeEmail}
    </form>
  );
}
