// /src/index.js
import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { cors } from 'hono/cors';
import { Hls, HlsParser } from 'hls-parser'; // This is correct

export const config = {
  runtime: 'edge',
};

const app = new Hono().basePath('/');

// --- Security / CORS ---
const checkAccess = (c, next) => {
  const origin = c.req.header('Origin');
  const referer = c.req.header('Referer');
  
  const allowedOrigins = (c.env.ORIGIN_WHITELIST || "").split(',');
  const allowedReferers = (c.env.REFERER_WHITELIST || "").split(',');

  let originOk = false;
  let refererOk = false;

  // Check Origin
  if (origin) {
    for (const allowed of allowedOrigins) {
      if (allowed && new URL(allowed).origin === new URL(origin).origin) {
        originOk = true;
        break;
      }
    }
  }

  // Check Referer
  if (referer) {
    for (const allowed of allowedReferers) {
      if (allowed && new URL(allowed).origin === new URL(referer).origin) {
        refererOk = true;
        break;
      }
    }
  }
  
  if (originOk || refererOk || (allowedOrigins.length === 0 && allowedReferers.length === 0)) {
    return next();
  }

  return c.json({ error: 'Access denied. Check CORS/Referer whitelist.' }, 403);
};

app.use('*', cors());
app.use('/proxy.m3u8', checkAccess);

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

    // --- THIS IS THE FIXED FUNCTION ---
    const createProxyUrl = (segmentUri) => {
      // Create a URL object from the worker's request URL
      const newUrl = new URL(req.url); 
      
      // Get the original M3U8 URL from the query
      const originalStreamUrl = new URL(newUrl.searchParams.get('url'));
      
      // Create the full, absolute URL for the segment/key
      const newSegmentUrl = new URL(segmentUri, originalStreamUrl);
      
      // Set the 'url' parameter to this new absolute segment URL
      newUrl.searchParams.set('url', newSegmentUrl.toString());

      // Return a relative path that uses your Vercel app's rewrite
      // This is the key fix!
      return `/api/m3u8-proxy?${newUrl.searchParams.toString()}`;
    };
    // --- END OF FIX ---

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
