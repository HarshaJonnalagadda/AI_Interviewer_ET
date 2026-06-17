import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get('url');
  const filename = req.nextUrl.searchParams.get('filename') || 'poster.png';

  if (!url) return NextResponse.json({ error: 'url required' }, { status: 400 });

  try {
    const imageRes = await fetch(url);
    if (!imageRes.ok) throw new Error(`Upstream fetch failed: ${imageRes.status}`);

    const buffer = await imageRes.arrayBuffer();
    const contentType = imageRes.headers.get('Content-Type') || 'image/png';

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Download failed' }, { status: 502 });
  }
}
