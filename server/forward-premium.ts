import { readBoundedBody } from '../convex/requestBody';
/** Compatibility adapter only. All authorization and provider work lives in Convex. */
export async function forwardPremium(request: Request, path: string) {
  const origin = process.env.CONVEX_SITE_URL || process.env.EXPO_PUBLIC_CONVEX_SITE_URL;
  if (!origin) return Response.json({ code: 'provider_failure', error: 'Personal feedback is temporarily unavailable.' }, { status: 503 });
  if (!request.headers.get('Authorization')) return Response.json({ code: 'authentication_required', error: 'Sign in to use personal feedback.' }, { status: 401 });
  try {
    const headers = new Headers();
    for (const name of ['Authorization', 'Content-Type', 'X-Operation-Id', 'X-Session-Key', 'X-Preview-Id']) {
      const value = request.headers.get(name);
      if (value) headers.set(name, value);
    }
    return await fetch(`${origin.replace(/\/$/, '')}${path}`, {
      method: 'POST', headers, body: await readBoundedBody(request, 20_000),
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(60_000)]),
    });
  } catch (error) {
    const invalid = error instanceof Error && error.message === 'invalid_request';
    return Response.json({ code: invalid ? 'invalid_request' : 'provider_failure', error: 'This request could not be processed. Please try again.' }, { status: invalid ? 400 : 502 });
  }
}
