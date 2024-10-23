export function getUrlWithProtocol(url: string): string {
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    return `https://${url}`;
  }
  return url;
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(getUrlWithProtocol(url));
    return true;
  } catch {
    return false;
  }
}
