// /src/index.js
import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { cors } from 'hono/cors';
import { Hls, HlsParser } from 'hls-parser';

export const config = {
  runtime: 'edge',
};

const app = new Hono().basePath('/');

// --- Security / CORS ---
// The custom 'checkAccess' function has been removed.
// We now just use the default Hono CORS middleware to allow all origins.
app.use('*', cors());

// --- Routes ---
app.get('/', (c) => {
  return c.text('HLS Proxy is running!');
});

app.get('/proxy.m3u8', async (c) => {
  const { req, env } = c;
  const url = req.query('url');

  if (!url) {
    return c.json({
      error: 'Missing "url" query parameter',
      example: '/?url=https://example.com/stream.m3u8',
    }, 400);
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': req.header('User-Agent') || 'HLS-Proxy',
      },
    });

    if (!response.ok) {
      return c.text(`Failed to fetch M3U8: ${response.status} ${response.statusText}`, response.status);
    }

    const m3u8Content = await response.text();
    const parser = new HlsParser();
    const playlist = parser.parse(m3u8Content);

    // This function rewrites all stream segments to point back to your Vercel app
    const createProxyUrl = (segmentUri) => {
      const newUrl = new URL(req.url); 
      const originalStreamUrl = new URL(newUrl.searchParams.get('url'));
      const newSegmentUrl = new URL(segmentUri, originalStreamUrl);
      newUrl.searchParams.set('url', newSegmentUrl.toString());
      return `/api/m3u8-proxy?${newUrl.searchParams.toString()}`;
    };

    if (playlist instanceof Hls) {
      // It's a master playlist
      playlist.variants.forEach((variant) => {
        if (variant.uri) {
          variant.uri = createProxyUrl(variant.uri);
        }
      });
    } else {
      // It's a media playlist
      playlist.segments.forEach((segment) => {
        if (segment.uri) {
          segment.uri = createProxyUrl(segment.uri);
        }
        if (segment.key && segment.key.uri) {
          segment.key.uri = createProxyUrl(segment.key.uri);
        }
      });
    }

    const modifiedM3u8 = parser.stringify(playlist);

    return new Response(modifiedM3u8, {
      headers: {
        'Content-Type': 'application/vnd.apple.mpegurl',
        'Access-Control-Allow-Origin': c.req.header('Origin') || '*',
      },
    });

  } catch (error) {
    return c.json({ error: 'Failed to proxy HLS stream', details: error.message }, 500);
  }
});

app.all('*', (c) => c.text('Not found', 404));

export default app;
