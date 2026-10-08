import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getLessonProgress } from '@/features/lessons/server/queries';
import { ListeningLesson } from '@/features/listening/components/listening-lesson';
import { toIntro } from '@/features/listening/lib/views';
import { getProfile } from '@/features/profile/server/queries';
import { findLessonMeta, unitTitle } from '@/lib/content/index';
import { loadListeningLesson } from '@/lib/content/loader';
import { env } from '@/lib/env';

export async function generateMetadata({ params }: PageProps<'/escuchar/[id]'>): Promise<Metadata> {
  const { id } = await params;
  return { title: findLessonMeta(id)?.title };
}

export default async function ListeningLessonPage({ params }: PageProps<'/escuchar/[id]'>) {
  const { id } = await params;
  const lesson = await loadListeningLesson(id);
  if (!lesson) notFound();

  const [profile, progress] = await Promise.all([getProfile(), getLessonProgress(id)]);

  return (
    <ListeningLesson
      // Solo sale del servidor lo que se puede ver antes de la fase 3: el guion se pide después.
      intro={toIntro(lesson)}
      unitTitle={unitTitle(lesson.unit)}
      audioBase={env.NEXT_PUBLIC_AUDIO_BASE_URL}
      initialPhase={progress?.status === 'started' ? progress.phase : 0}
      previous={
        progress?.status === 'completed'
          ? { score: progress.score, version: progress.lessonVersion }
          : null
      }
      playbackRate={profile.settings.playback_rate}
    />
  );
}
