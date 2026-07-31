/**
 * Transform external GIF URLs to use Discord URL mappings.
 * 
 * Discord Activities run in a sandboxed iframe that blocks external URLs.
 * You must configure URL mappings in Discord Developer Portal → Activities → URL Mappings:
 *   /giphy → media.giphy.com
 *   /tenor → media.tenor.com (if using Tenor)
 * 
 * This function converts full URLs like:
 *   https://media.giphy.com/media/abc123/giphy.gif
 * To proxied paths like:
 *   /giphy/media/abc123/giphy.gif
 */
export function proxyGifUrl(url: string): string {
  if (!url) return '';
  
  try {
    const parsed = new URL(url);
    
    // Map known GIF CDN hosts to their URL mapping prefixes
    if (parsed.hostname === 'media.giphy.com') {
      return `/giphy${parsed.pathname}`;
    }
    if (parsed.hostname.includes('tenor.com')) {
      return `/tenor${parsed.pathname}`;
    }
    
    // For unknown hosts, return as-is (may be blocked by Discord CSP)
    console.warn('[proxyGifUrl] Unknown GIF host, may be blocked:', parsed.hostname);
    return url;
  } catch {
    // Invalid URL, return as-is
    return url;
  }
}
