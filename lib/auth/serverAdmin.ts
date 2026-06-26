import { createServiceClient } from '@/lib/supabase/service';

export async function getServerAdmin(): Promise<{ adminId: string; email: string } | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('admins')
    .select('id, email')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  return data ? { adminId: data.id, email: data.email } : null;
}
