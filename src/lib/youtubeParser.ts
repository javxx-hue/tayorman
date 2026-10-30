export interface YouTubeVideoInfo {
  videoId: string;
  thumbnailUrl: string;
  title?: string;
  embedUrl: string;
}

export function extractYouTubeId(url: string): string | null {
  if (!url) return null;
  const cleanUrl = url.trim();
  
  // Standard watch URL: youtube.com/watch?v=ID
  const watchMatch = cleanUrl.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch && watchMatch[1]) return watchMatch[1];

  // Short URL: youtu.be/ID
  const shortMatch = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch && shortMatch[1]) return shortMatch[1];

  // Embed or Shorts: youtube.com/embed/ID or youtube.com/shorts/ID
  const embedMatch = cleanUrl.match(/youtube\.com\/(?:embed|shorts)\/([a-zA-Z0-9_-]{11})/);
  if (embedMatch && embedMatch[1]) return embedMatch[1];

  return null;
}

export function getYouTubeInfo(url: string): YouTubeVideoInfo | null {
  const videoId = extractYouTubeId(url);
  if (!videoId) return null;

  return {
    videoId,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
    embedUrl: `https://www.youtube.com/embed/${videoId}`,
  };
}

export async function fetchYouTubeTitle(url: string): Promise<string | null> {
  try {
    const res = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.title || null;
  } catch {
    return null;
  }
}
