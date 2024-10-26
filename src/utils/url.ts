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

export function normalizePath(baseUrl: string, pathname: string): string {
  try {
    // Remove the query string
    pathname = pathname.split("?")[0];

    // Remove trailing slashes and convert to lowercase
    let normalized = pathname.toLowerCase().replace(/\/$/, "");

    // Remove common file extensions
    normalized = normalized.replace(/\.(html?|php|asp|jsp)$/, "");

    // Remove common dynamic segments patterns
    const dynamicSegmentPatterns = [
      /:[a-zA-Z_]+/g, // :email, :id, etc
      /\{[a-zA-Z_]+\}/g, // {email}, {id}, etc
      /\[\w+\]/g, // [email], [id], etc
      /\/\d{4}\/\d{2}\/\d{2}\//g, // date patterns like /2024/03/26/
      /\/page\/\d+/g, // pagination patterns
      /\/\d+$/g, // ending with numbers
      /\/p\d+$/g, // ending with p1, p2, etc
      /\/tag\/.+$/g, // tag pages
      /\/category\/.+$/g, // category pages
      /\/author\/.+$/g, // author pages
      /\/(archive|search)\/.*/g, // archive and search pages
      /\/comment-page-\d+$/g, // comment pages
      /\/feed\/?$/g, // feed URLs
      /\/amp\/?$/g, // AMP pages
    ];

    // Apply all patterns
    for (const pattern of dynamicSegmentPatterns) {
      normalized = normalized.replace(pattern, "");
    }

    // Ensure the path starts with /
    if (!normalized.startsWith("/")) {
      normalized = "/" + normalized;
    }

    // Convert empty path to /
    if (normalized === "") {
      normalized = "/";
    }

    // Combine with base URL to get full URL
    return new URL(normalized, baseUrl).toString().replace(/\/$/, "");
  } catch (e) {
    return new URL(pathname, baseUrl).toString();
  }
}
