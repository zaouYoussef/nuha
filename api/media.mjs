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

export default async function handler(req, res) {
  const id = req.query.id;
  const name = req.query.name || '';
  if (!id) {
    res.status(400).json({ error: 'missing id' });
    return;
  }
  const ext = path.extname(name);
  const contentType = MIME[ext] || 'application/octet-stream';
  const driveUrl = 'https://drive.usercontent.google.com/download?id=' + encodeURIComponent(id) + '&export=download&confirm=t';

  const headers = {};
  if (req.headers.range) headers.Range = req.headers.range;

  let upstream;
  try {
    upstream = await fetch(driveUrl, { headers });
  } catch (e) {
    res.status(502).json({ error: 'upstream unreachable: ' + e.message });
    return;
  }

  if (!upstream.ok && upstream.status !== 206) {
    res.status(upstream.status).json({ error: 'upstream ' + upstream.status });
    return;
  }

  res.status(upstream.status);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Disposition', 'inline; filename="' + name.replace(/"/g, '') + '"');

  const cr = upstream.headers.get('content-range');
  if (cr) res.setHeader('Content-Range', cr);
  const cl = upstream.headers.get('content-length');
  if (cl) res.setHeader('Content-Length', cl);

  if (upstream.body) {
    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        res.write(Buffer.from(value));
      }
    } catch (e) {
      if (!res.headersSent) res.status(502).end('proxy stream error');
      res.destroy();
      return;
    }
  }
  res.end();
}
