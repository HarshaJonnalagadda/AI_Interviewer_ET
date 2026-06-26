import { createServiceClient } from '@/lib/supabase/service';

export async function getAdminId(): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('admins')
    .select('id')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  return data?.id ?? null;
}
