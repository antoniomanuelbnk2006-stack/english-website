import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { Button } from '@/components/ui/button';
import { PageContainer, PageHeader, PageSections } from '@/components/ui/page';
import { Panel, PanelTitle } from '@/components/ui/panel';
import { signOut } from '@/features/auth/server/actions';
import { ConsentSettings } from '@/features/consent/components/consent-settings';
import { SettingsForm } from '@/features/profile/components/settings-form';
import { getProfile } from '@/features/profile/server/queries';
import { getSessionOrRedirect } from '@/lib/auth';
import { CONSENT_COOKIE, COOKIE_POLICY_URL, PRIVACY_POLICY_URL, parseConsent } from '@/lib/consent';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getT())('nav.settings') };
}

export default async function SettingsPage() {
  await getSessionOrRedirect();
  const [t, profile, cookieStore] = await Promise.all([getT(), getProfile(), cookies()]);
  const consent = parseConsent(cookieStore.get(CONSENT_COOKIE)?.value);

  return (
    <PageContainer>
      <PageHeader title={t('settings.title')} />

      <PageSections>
        <SettingsForm
          initial={{
            dailyGoalMin: profile.dailyGoalMin,
            interests: profile.interests,
            uiLocale: profile.uiLocale,
            theme: profile.settings.theme,
            readingFontPx: profile.settings.reading_font_px,
            readerPaper: profile.settings.reader_paper,
            playbackRate: profile.settings.playback_rate,
          }}
        />

        <Panel className="flex flex-col gap-3">
          <PanelTitle>{t('settings.accountTitle')}</PanelTitle>
          <p className="text-body-sm text-muted">
            {t('settings.signedInAs', { email: profile.email })}
          </p>
          <form action={signOut}>
            <Button type="submit" variant="secondary">
              {t('nav.signOut')}
            </Button>
          </form>
        </Panel>

        <Panel className="flex flex-col gap-3">
          <PanelTitle>{t('consent.title')}</PanelTitle>
          <p className="text-body-sm text-muted">
            {t('consent.settingsBody')}{' '}
            <a href={COOKIE_POLICY_URL} className="text-accent-text underline underline-offset-4">
              {t('consent.policy')}
            </a>
          </p>
          <ConsentSettings initial={consent} />
        </Panel>

        <Panel className="flex flex-col gap-3 text-body-sm text-muted">
          <PanelTitle>{t('settings.aboutTitle')}</PanelTitle>
          <p>{t('settings.aboutContent')}</p>
          <p>{t('settings.aboutVoices')}</p>
          <p>{t('settings.aboutWordlists')}</p>
          <p>
            <a href={PRIVACY_POLICY_URL} className="text-accent-text underline underline-offset-4">
              {t('consent.privacy')}
            </a>
          </p>
        </Panel>
      </PageSections>
    </PageContainer>
  );
}
