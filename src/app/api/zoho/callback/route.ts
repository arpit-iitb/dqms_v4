import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/zoho";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code");

    if (!code) {
      const clientId = process.env.ZOHO_CLIENT_ID ?? "YOUR_CLIENT_ID";
      const origin = request.nextUrl.origin;
      const redirectUri = `${origin}/api/zoho/callback`;
      const authUrl =
        `https://accounts.zoho.in/oauth/v2/auth?` +
        `scope=ZohoBooks.fullaccess.all` +
        `&client_id=${clientId}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&access_type=offline` +
        `&prompt=consent`;

      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Zoho OAuth Setup</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:4rem auto;padding:0 1rem;line-height:1.6}
code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:0.9em}
a{color:#2563eb}</style></head>
<body>
<h1>Zoho OAuth Setup</h1>
<p>No authorization code found. To connect your Zoho Books account:</p>
<ol>
  <li>Make sure <code>ZOHO_CLIENT_ID</code> and <code>ZOHO_CLIENT_SECRET</code> are set in your <code>.env</code> file.</li>
  <li>Visit the authorization URL below to grant access:</li>
</ol>
<p><a href="${authUrl}" target="_blank">${authUrl}</a></p>
<p>After authorizing, you will be redirected back here with a code that will be exchanged for tokens.</p>
</body></html>`;

      return new NextResponse(html, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    const redirectUri = `${request.nextUrl.origin}/api/zoho/callback`;
    const tokens = await exchangeCodeForTokens(code, redirectUri);

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Zoho OAuth - Success</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:4rem auto;padding:0 1rem;line-height:1.6}
code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:0.9em;word-break:break-all}
.token-box{background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:1rem;margin:1rem 0}
.warning{color:#b91c1c;font-weight:600}</style></head>
<body>
<h1>Zoho OAuth - Success!</h1>
<p>Authorization was successful. Copy the refresh token below and add it to your <code>.env</code> file.</p>
<div class="token-box">
  <p><strong>Refresh Token:</strong></p>
  <p><code>${tokens.refresh_token}</code></p>
</div>
<p>Add this line to your <code>.env</code> file:</p>
<pre><code>ZOHO_REFRESH_TOKEN=${tokens.refresh_token}</code></pre>
<p class="warning">Do not share this token. It provides full access to your Zoho Books account.</p>
<p>Access token (expires in ${tokens.expires_in}s): <code>${tokens.access_token.slice(0, 20)}...</code></p>
</body></html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error during OAuth callback";

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Zoho OAuth - Error</title>
<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:4rem auto;padding:0 1rem;line-height:1.6}
code{background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:0.9em}
.error-box{background:#fef2f2;border:1px solid #fca5a5;border-radius:8px;padding:1rem;margin:1rem 0}</style></head>
<body>
<h1>Zoho OAuth - Error</h1>
<div class="error-box">
  <p><strong>Error:</strong> <code>${message}</code></p>
</div>
<p>Please check your <code>ZOHO_CLIENT_ID</code> and <code>ZOHO_CLIENT_SECRET</code> environment variables and try again.</p>
<p><a href="/api/zoho/callback">Retry</a></p>
</body></html>`;

    return new NextResponse(html, {
      status: 500,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    });
  }
}
