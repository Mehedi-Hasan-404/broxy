/**
 * Cloudflare Workers CORS Stream Proxy
 * Handles CORS-restricted streaming URLs with referer support
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Extract target URL from query parameter
    const targetUrl = url.searchParams.get('url');
    
    if (!targetUrl) {
      return new Response(
        JSON.stringify({
          error: 'Missing "url" query parameter',
          example: '/?url=https%3A%2F%2Fexample.com%2Fstream.m3u8'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders()
          }
        }
      );
    }

    try {
      const response = await fetchStream(targetUrl);
      
      // Add CORS headers to response
      const headers = new Headers(response.headers);
      Object.entries(getCorsHeaders()).forEach(([key, value]) => {
        headers.set(key, value);
      });

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: headers
      });

    } catch (error) {
      console.error('Proxy error:', error);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch stream',
          message: error.message
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            ...getCorsHeaders()
          }
        }
      );
    }
  }
};

/**
 * Parse URL and referer from encoded parameter
 * Format: url or url|Referer=referer_url
 */
function parseStreamUrl(encoded) {
  const decoded = decodeURIComponent(encoded);
  
  if (decoded.includes('|Referer=')) {
    const [streamUrl, refererPart] = decoded.split('|Referer=');
    return {
      streamUrl: streamUrl.trim(),
      referer: refererPart.trim()
    };
  }

  return {
    streamUrl: decoded,
    referer: null
  };
}

/**
 * Fetch the stream with proper headers
 */
async function fetchStream(encoded) {
  const { streamUrl, referer } = parseStreamUrl(encoded);

  // Validate URL
  try {
    new URL(streamUrl);
  } catch {
    throw new Error('Invalid URL provided');
  }

  // Build headers
  const headers = new Headers({
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Upgrade-Insecure-Requests': '1'
  });

  // Add referer if provided
  if (referer) {
    headers.set('Referer', referer);
  }

  // Fetch the stream
  const response = await fetch(streamUrl, {
    method: 'GET',
    headers: headers,
    cf: {
      cacheEverything: true,
      cacheTtl: 3600,
      mirage: true
    }
  });

  if (!response.ok) {
    throw new Error(`Upstream server returned ${response.status}`);
  }

  return response;
}

/**
 * Get CORS headers for response
 */
function getCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Range, Authorization',
    'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Content-Type, Content-Disposition',
    'Access-Control-Max-Age': '86400',
    'Cross-Origin-Embedder-Policy': 'credentialless',
    'X-Content-Type-Options': 'nosniff'
  };
}

/**
 * Handle CORS preflight requests
 */
function handleOptions(request) {
  return new Response(null, {
    headers: {
      ...getCorsHeaders(),
      'Content-Length': '0'
    }
  });
}
