import path from 'path';

const MIME = {
  '.mov': 'video/quicktime',
  '.MOV': 'video/quicktime',
  '.mp4': 'video/mp4',
  '.MP4': 'video/mp4',
  '.webm': 'video/webm',
  '.jpg': 'image/jpeg',
  '.JPG': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.JPEG': 'image/jpeg',
  '.png': 'image/png',
  '.PNG': 'image/png',
  '.gif': 'image/gif'
};

export default async function handler(req) {
  const url = new URL(req.url);
  const id = url.searchParams.get('id');
  const name = url.searchParams.get('name') || '';
  if (!id) {
    return new Response(JSON.stringify({ error: 'missing id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const ext = path.extname(name);
  const contentType = MIME[ext] || 'application/octet-stream';
  const driveUrl = 'https://drive.usercontent.google.com/download?id=' + encodeURIComponent(id) + '&export=download&confirm=t';

  const headers = {};
  const range = req.headers.get('range');
  if (range) headers.Range = range;

  let upstream;
  try {
    upstream = await fetch(driveUrl, { headers });
  } catch (e) {
    return new Response(JSON.stringify({ error: 'upstream unreachable: ' + e.message }), { status: 502, headers: { 'Content-Type': 'application/json' } });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return new Response(JSON.stringify({ error: 'upstream ' + upstream.status }), { status: upstream.status, headers: { 'Content-Type': 'application/json' } });
  }

  const resHeaders = new Headers();
  resHeaders.set('Content-Type', contentType);
  resHeaders.set('Accept-Ranges', 'bytes');
  resHeaders.set('Access-Control-Allow-Origin', '*');
  resHeaders.set('Content-Disposition', 'inline; filename="' + name.replace(/"/g, '') + '"');

  const cr = upstream.headers.get('content-range');
  if (cr) resHeaders.set('Content-Range', cr);
  const cl = upstream.headers.get('content-length');
  if (cl) resHeaders.set('Content-Length', cl);

  return new Response(upstream.body, { status: upstream.status, headers: resHeaders });
}
