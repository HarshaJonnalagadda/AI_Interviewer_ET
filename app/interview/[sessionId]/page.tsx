import { notFound } from 'next/navigation';
import { createServiceClient } from '@/lib/supabase/service';
import InterviewClient from './InterviewClient';

export const dynamic = 'force-dynamic';

export default async function InterviewPage({ params }: { params: { sessionId: string } }) {
  const supabase = createServiceClient();

  const { data: session } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', params.sessionId)
    .maybeSingle();

  if (!session) notFound();

  const { data: film } = await supabase
    .from('film_configs')
    .select('question_count, session_title')
    .eq('id', session.film_config_id)
    .maybeSingle();

  return (
    <InterviewClient
      sessionId={session.id}
      status={session.status}
      language={session.language}
      filmName={session.film_name}
      celebrityName={session.celebrity_name}
      sessionTitle={film?.session_title ?? null}
      questionCount={film?.question_count ?? session.current_turn ?? 1}
      currentTurn={session.current_turn ?? 0}
      viewerGreeting={session.viewer_greeting}
      celebrityGreeting={session.celebrity_greeting}
      celebrityGreetingTranslation={session.celebrity_greeting_translation}
    />
  );
}
