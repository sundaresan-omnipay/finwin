// The Supabase session stored in cookies includes the full User object (identities, metadata,
// etc.) which can inflate the cookie set to 15+ chunks (~48KB), triggering Vercel's 494
// REQUEST_HEADER_TOO_LARGE error. Only the tokens are needed for auth — the user can always
// be fetched fresh from Supabase's server via getUser().
//
// This module is used in all three Supabase client entry points (browser, server, middleware)
// to intercept the setAll cookie write, strip the user object, and re-chunk the smaller result.

const B64_PREFIX = "base64-";
const CHUNK_SIZE = 3180;
const AUTH_CHUNK_RE = /^sb-.+-auth-token(\.\d+)?$/;

function b64urlDecode(str: string): string {
  const b64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return atob(padded);
}

function b64urlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

type CookieItem = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export function compressSessionCookies(cookiesToSet: CookieItem[]): CookieItem[] {
  // Separate non-empty auth-token chunks from everything else
  const authChunks = cookiesToSet.filter(
    (c) => AUTH_CHUNK_RE.test(c.name) && c.value !== ""
  );
  const rest = cookiesToSet.filter(
    (c) => !AUTH_CHUNK_RE.test(c.name) || c.value === ""
  );

  if (authChunks.length === 0) return cookiesToSet;

  // Sort by numeric chunk index (.0, .1, .2 …)
  const sorted = [...authChunks].sort((a, b) => {
    const ai = parseInt(a.name.match(/\.(\d+)$/)?.[1] ?? "-1");
    const bi = parseInt(b.name.match(/\.(\d+)$/)?.[1] ?? "-1");
    return ai - bi;
  });

  // Reassemble the full encoded string from chunk values
  let fullEncoded = sorted.map((c) => c.value).join("");
  if (fullEncoded.startsWith(B64_PREFIX)) {
    fullEncoded = fullEncoded.slice(B64_PREFIX.length);
  }

  // Decode the session JSON
  let session: Record<string, unknown>;
  try {
    session = JSON.parse(b64urlDecode(fullEncoded));
  } catch {
    return cookiesToSet; // fall back to original on any decode error
  }

  // Keep only the fields needed for server-side auth — strip the user object
  const slim = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
    expires_in: session.expires_in,
    token_type: session.token_type,
  });

  // Re-encode using the same base64url+prefix format the library expects
  const encoded = B64_PREFIX + b64urlEncode(slim);

  // Re-chunk using the same logic as @supabase/ssr's createChunks
  const baseName = sorted[0].name.replace(/\.\d+$/, "");
  const baseOpts = sorted[0].options;
  const newChunks: CookieItem[] = [];
  let encodedURI = encodeURIComponent(encoded);

  if (encodedURI.length <= CHUNK_SIZE) {
    newChunks.push({ name: baseName, value: encoded, options: baseOpts });
  } else {
    let i = 0;
    while (encodedURI.length > 0) {
      let head = encodedURI.slice(0, CHUNK_SIZE);
      const lastPct = head.lastIndexOf("%");
      if (lastPct > CHUNK_SIZE - 3) head = head.slice(0, lastPct);
      newChunks.push({
        name: `${baseName}.${i}`,
        value: decodeURIComponent(head),
        options: baseOpts,
      });
      encodedURI = encodedURI.slice(head.length);
      i++;
    }
  }

  // Expire any old chunks not present in the new (smaller) set
  const newNames = new Set(newChunks.map((c) => c.name));
  const deletions: CookieItem[] = authChunks
    .filter((c) => !newNames.has(c.name))
    .map((c) => ({
      name: c.name,
      value: "",
      options: { maxAge: 0, path: "/" } as Record<string, unknown>,
    }));

  return [...rest, ...deletions, ...newChunks];
}
