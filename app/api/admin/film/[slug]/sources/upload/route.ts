import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/service';
import { getAdminId } from '@/lib/auth/requireAdmin';

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function extFromContentType(contentType: string): string {
  return EXT_BY_MIME[contentType] || 'jpg';
}

export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const adminId = await getAdminId(req);
  if (!adminId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data: film, error } = await supabase
    .from('film_configs')
    .select('id')
    .eq('slug', params.slug)
    .eq('admin_id', adminId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!film) return NextResponse.json({ error: 'Film not found' }, { status: 404 });

  const contentType = req.headers.get('content-type') || '';

  let buffer: Buffer;
  let mimeType: string;

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    mimeType = file.type || 'image/jpeg';
    buffer = Buffer.from(await file.arrayBuffer());
  } else {
    const { imageUrl } = await req.json();
    if (!imageUrl || typeof imageUrl !== 'string') {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 });
    }
    const imgRes = await fetch(imageUrl);
    if (!imgRes.ok) {
      return NextResponse.json({ error: `Failed to fetch image (${imgRes.status})` }, { status: 400 });
    }
    mimeType = imgRes.headers.get('content-type') || 'image/jpeg';
    buffer = Buffer.from(await imgRes.arrayBuffer());
  }

  const ext = extFromContentType(mimeType);
  const path = `sources/${film.id}/${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('posters')
    .upload(path, buffer, { contentType: mimeType, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data: publicUrl } = supabase.storage.from('posters').getPublicUrl(path);

  const { data: source, error: insertError } = await supabase
    .from('ingestion_queue')
    .insert({
      film_config_id: film.id,
      source_type: 'poster',
      file_path: publicUrl.publicUrl,
      status: 'pending',
    })
    .select()
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });
  return NextResponse.json({ source });
}
