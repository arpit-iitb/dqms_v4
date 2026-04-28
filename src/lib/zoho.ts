// Server-only module — do NOT add "use client"
// Zoho Books API client with OAuth2 token management

const ZOHO_OAUTH_BASE = "https://accounts.zoho.in";
const ZOHO_API_BASE = "https://www.zohoapis.in/books/v3";

interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

function getConfig() {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;
  const refreshToken = process.env.ZOHO_REFRESH_TOKEN;
  const orgId = process.env.ZOHO_ORG_ID;

  if (!clientId || !clientSecret || !refreshToken || !orgId) {
    throw new Error("Zoho credentials not configured");
  }

  return { clientId, clientSecret, refreshToken, orgId };
}

/** Check if all Zoho env vars are present */
export function isConfigured(): boolean {
  return !!(
    process.env.ZOHO_CLIENT_ID &&
    process.env.ZOHO_CLIENT_SECRET &&
    process.env.ZOHO_REFRESH_TOKEN &&
    process.env.ZOHO_ORG_ID
  );
}

/** Get a valid access token, refreshing if needed */
async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 60_000) {
    return tokenCache.accessToken;
  }

  const { clientId, clientSecret, refreshToken } = getConfig();

  const params = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
  });

  const res = await fetch(`${ZOHO_OAUTH_BASE}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
    signal: AbortSignal.timeout(8_000),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json();

  if (data.error) {
    throw new Error(`Zoho token error: ${data.error}`);
  }

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
  };

  return tokenCache.accessToken;
}

/** Authenticated GET request to Zoho Books API */
export async function zohoGet<T = unknown>(
  path: string,
  params?: Record<string, string>
): Promise<T> {
  const { orgId } = getConfig();
  const token = await getAccessToken();

  const url = new URL(`${ZOHO_API_BASE}${path}`);
  url.searchParams.set("organization_id", orgId);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
    }
  }

  let res = await fetch(url.toString(), {
    headers: { Authorization: `Zoho-oauthtoken ${token}` },
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1000));
    const freshToken = await getAccessToken();
    res = await fetch(url.toString(), {
      headers: { Authorization: `Zoho-oauthtoken ${freshToken}` },
      signal: AbortSignal.timeout(10_000),
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (data.code !== undefined && data.code !== 0) {
    throw new Error(`Zoho API error: ${data.message || JSON.stringify(data)}`);
  }

  return data as T;
}

/** Authenticated POST request to Zoho Books API */
export async function zohoPost<T = unknown>(
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const { orgId } = getConfig();
  const token = await getAccessToken();

  const url = new URL(`${ZOHO_API_BASE}${path}`);
  url.searchParams.set("organization_id", orgId);

  let res = await fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });

  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, 1000));
    const freshToken = await getAccessToken();
    res = await fetch(url.toString(), {
      method: "POST",
      headers: {
        Authorization: `Zoho-oauthtoken ${freshToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Zoho API error: ${res.status} ${text}`);
  }

  const data = await res.json();
  if (data.code !== undefined && data.code !== 0) {
    throw new Error(`Zoho API error: ${data.message || JSON.stringify(data)}`);
  }

  return data as T;
}

/** Exchange authorization code for tokens (one-time OAuth setup) */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string
): Promise<{ access_token: string; refresh_token: string; expires_in: number }> {
  const clientId = process.env.ZOHO_CLIENT_ID;
  const clientSecret = process.env.ZOHO_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("ZOHO_CLIENT_ID and ZOHO_CLIENT_SECRET must be set");
  }

  const params = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
  });

  const res = await fetch(`${ZOHO_OAUTH_BASE}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await res.json();
  if (data.error) {
    throw new Error(`Token exchange failed: ${data.error}`);
  }

  return data;
}
