import NextAuth, { CredentialsSignin } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import type { Provider } from 'next-auth/providers';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { headers } from 'next/headers';

class AccountDeactivatedError extends CredentialsSignin {
  code = "ACCOUNT_DEACTIVATED";
}

const getClientHeaders = async () => {
  try {
    const reqHeaders = await headers();
    const ua = reqHeaders.get('user-agent') || undefined;
    const ip = reqHeaders.get('x-forwarded-for') || reqHeaders.get('x-real-ip') || undefined;
    return { ua, ip };
  } catch {
    return { ua: undefined, ip: undefined };
  }
};


type AccessTokenClaims = {
  sub: string;
  role: string;
  typeId: number;
  iat: number;
  exp: number;
};

type BackendAuthResponse = {
  data?: {
    accessToken?: string;
  };
};

const getBackendApiBaseUrl = (): string => {
  const raw = process.env.AUTH_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
  return raw.replace(/\/$/, '');
};

const getRefreshCookieName = (): string => {
  return process.env.AUTH_REFRESH_COOKIE_NAME || 'mollari_refresh_token';
};

const getAuthSecret = (): string => {
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('⚠️ Warning: Neither AUTH_SECRET nor NEXTAUTH_SECRET was provided. Using fallback secret for build.');
      return 'mollari-production-secret-fallback-minimum-32-chars-required';
    }
    return 'development-secret-key-mollari-12345';
  }

  return secret;
};

const toBase64 = (value: string): string => {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  return normalized + '='.repeat(paddingLength);
};

const decodeBase64 = (value: string): string => {
  if (typeof atob === 'function') {
    return atob(value);
  }

  return Buffer.from(value, 'base64').toString('utf8');
};

const decodeAccessToken = (token: string): AccessTokenClaims => {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Malformed JWT');
  }

  const payload = parts[1];
  const decoded = decodeBase64(toBase64(payload));
  return JSON.parse(decoded) as AccessTokenClaims;
};

export const getAccessTokenClaims = (token?: string | null): AccessTokenClaims | null => {
  if (!token) {
    return null;
  }

  try {
    return decodeAccessToken(token);
  } catch {
    return null;
  }
};

export const getRoleFromAccessToken = (token?: string | null): string | null => {
  return getAccessTokenClaims(token)?.role ?? null;
};

const getSetCookieHeaders = (headers: Headers): string[] => {
  const withGetSetCookie = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetSetCookie.getSetCookie === 'function') {
    return withGetSetCookie.getSetCookie();
  }

  const single = headers.get('set-cookie');
  return single ? [single] : [];
};

const escapeRegex = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const readRefreshTokenFromSetCookie = (setCookieHeaders: string[]): string | null => {
  const refreshCookieName = getRefreshCookieName();
  const matcher = new RegExp(`${escapeRegex(refreshCookieName)}=([^;]+)`);

  for (const cookieHeader of setCookieHeaders) {
    const match = cookieHeader.match(matcher);
    if (match?.[1]) {
      return decodeURIComponent(match[1]);
    }
  }

  return null;
};

const parseBackendToken = async (response: Response): Promise<{ accessToken: string; refreshToken: string; claims: AccessTokenClaims }> => {
  const body = (await response.json()) as BackendAuthResponse;
  const accessToken = body?.data?.accessToken;

  if (!accessToken) {
    throw new Error('Backend auth response did not include an access token');
  }

  const refreshToken = readRefreshTokenFromSetCookie(getSetCookieHeaders(response.headers));
  if (!refreshToken) {
    throw new Error('Backend auth response did not include a refresh token cookie');
  }

  return {
    accessToken,
    refreshToken,
    claims: decodeAccessToken(accessToken),
  };
};

const getGoogleProviderConfig = (): { clientId: string; clientSecret: string } | null => {
  const clientId =
    process.env.AUTH_GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const clientSecret = process.env.AUTH_GOOGLE_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  return { clientId, clientSecret };
};

const authenticateWithGoogle = async ({ idToken, accessToken }: { idToken?: string; accessToken?: string }): Promise<{ accessToken?: string; refreshToken?: string; claims?: AccessTokenClaims; error?: string } | null> => {
  if (!idToken && !accessToken) {
    return null;
  }

  const clientHdrs = await getClientHeaders();
  const response = await fetch(`${getBackendApiBaseUrl()}/auth/google`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(clientHdrs.ua ? { 'User-Agent': clientHdrs.ua } : {}),
      ...(clientHdrs.ip ? { 'X-Forwarded-For': clientHdrs.ip } : {}),
    },
    body: JSON.stringify({ idToken, accessToken }),
    cache: 'no-store',
  });

  if (!response.ok) {
    try {
      const errBody = await response.json();
      if (errBody?.code === 'USER_INACTIVE' || errBody?.message?.includes('inactive') || errBody?.message?.includes('deactivated')) {
        return { error: 'ACCOUNT_DEACTIVATED' };
      }
    } catch {}
    return null;
  }

  const parsed = await parseBackendToken(response);
  return { ...parsed };
};

const refreshAccessToken = async (token: JWT): Promise<JWT> => {
  try {
    if (!token.refreshToken || typeof token.refreshToken !== 'string') {
      return { ...token, error: 'MissingRefreshToken' };
    }

    const refreshCookieName = getRefreshCookieName();
    const clientHdrs = await getClientHeaders();
    const response = await fetch(`${getBackendApiBaseUrl()}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: `${refreshCookieName}=${encodeURIComponent(token.refreshToken)}`,
        ...(clientHdrs.ua ? { 'User-Agent': clientHdrs.ua } : {}),
        ...(clientHdrs.ip ? { 'X-Forwarded-For': clientHdrs.ip } : {}),
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      return {
        ...token,
        error: 'RefreshAccessTokenError',
        accessTokenExpiresAt: Infinity, // Prevent immediate retry loop
      };
    }

    const parsed = await parseBackendToken(response);

    return {
      ...token,
      userId: parsed.claims.sub,
      role: parsed.claims.role,
      typeId: parsed.claims.typeId,
      accessToken: parsed.accessToken,
      accessTokenExpiresAt: parsed.claims.exp * 1000,
      refreshToken: parsed.refreshToken,
      error: undefined,
    };
  } catch {
    return {
      ...token,
      error: 'RefreshAccessTokenError',
      accessTokenExpiresAt: Infinity, // Prevent immediate retry loop
    };
  }
};

const providers: Provider[] = [
  Credentials({
    name: 'Email and Password',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      const email = String(credentials?.email || '').trim().toLowerCase();
      const password = String(credentials?.password || '');

      if (!email || !password) {
        return null;
      }

      const clientHdrs = await getClientHeaders();
      const response = await fetch(`${getBackendApiBaseUrl()}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(clientHdrs.ua ? { 'User-Agent': clientHdrs.ua } : {}),
          ...(clientHdrs.ip ? { 'X-Forwarded-For': clientHdrs.ip } : {}),
        },
        body: JSON.stringify({ email, password }),
        cache: 'no-store',
      });

      if (!response.ok) {
        try {
          const errBody = await response.json();
          const msg = errBody?.message || '';
          if (msg.includes('deactivated') || errBody?.code === 'USER_INACTIVE') {
            throw new AccountDeactivatedError();
          }
        } catch (e) {
          if (e instanceof AccountDeactivatedError) throw e;
        }
        return null;
      }

      const parsed = await parseBackendToken(response);

      return {
        id: parsed.claims.sub,
        email,
        role: parsed.claims.role,
        typeId: parsed.claims.typeId,
        accessToken: parsed.accessToken,
        accessTokenExpiresAt: parsed.claims.exp * 1000,
        refreshToken: parsed.refreshToken,
      };
    },
  }),
  Credentials({
    id: 'register',
    name: 'Register',
    credentials: {
      firstName: { label: 'First Name', type: 'text' },
      lastName: { label: 'Last Name', type: 'text' },
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
      phone: { label: 'Phone', type: 'text' },
    },
    async authorize(credentials) {
      const firstName = String(credentials?.firstName || '').trim();
      const lastName = String(credentials?.lastName || '').trim();
      const email = String(credentials?.email || '').trim().toLowerCase();
      const password = String(credentials?.password || '');
      const phone = String(credentials?.phone || '').trim();

      if (!firstName || !lastName || !email || !password) {
        return null;
      }

      const clientHdrs = await getClientHeaders();
      const response = await fetch(`${getBackendApiBaseUrl()}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(clientHdrs.ua ? { 'User-Agent': clientHdrs.ua } : {}),
          ...(clientHdrs.ip ? { 'X-Forwarded-For': clientHdrs.ip } : {}),
        },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          password,
          phone: phone || undefined,
        }),
        cache: 'no-store',
      });

      if (!response.ok) {
        return null;
      }

      const parsed = await parseBackendToken(response);

      return {
        id: parsed.claims.sub,
        email,
        role: parsed.claims.role,
        typeId: parsed.claims.typeId,
        accessToken: parsed.accessToken,
        accessTokenExpiresAt: parsed.claims.exp * 1000,
        refreshToken: parsed.refreshToken,
      };
    },
  }),
];

const googleProviderConfig = getGoogleProviderConfig();
if (googleProviderConfig) {
  providers.push(
    Google({
      clientId: googleProviderConfig.clientId,
      clientSecret: googleProviderConfig.clientSecret,
    })
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: getAuthSecret(),
  providers,
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === 'google') {
        const idToken = typeof account.id_token === 'string' ? account.id_token : null;
        const accessToken = typeof account.access_token === 'string' ? account.access_token : null;

        if (!idToken && !accessToken) {
          return {
            ...token,
            error: 'GoogleSignInError',
          };
        }

        const parsed = await authenticateWithGoogle({
          idToken: idToken || undefined,
          accessToken: accessToken || undefined,
        });
        if (!parsed) {
          return {
            ...token,
            error: 'GoogleSignInError',
          };
        }

        if (parsed.error) {
          return {
            ...token,
            error: parsed.error,
          };
        }

        return {
          ...token,
          userId: parsed.claims?.sub,
          role: parsed.claims?.role,
          typeId: parsed.claims?.typeId,
          accessToken: parsed.accessToken,
          accessTokenExpiresAt: parsed.claims?.exp ? parsed.claims.exp * 1000 : 0,
          refreshToken: parsed.refreshToken,
          error: undefined,
        };
      }

      if (user) {
        const signedInUser = user as typeof user & {
          role: string;
          typeId: number;
          accessToken: string;
          accessTokenExpiresAt: number;
          refreshToken: string;
        };

        return {
          ...token,
          userId: signedInUser.id,
          role: signedInUser.role,
          typeId: signedInUser.typeId,
          accessToken: signedInUser.accessToken,
          accessTokenExpiresAt: signedInUser.accessTokenExpiresAt,
          refreshToken: signedInUser.refreshToken,
          error: undefined,
        };
      }

      if (!token.accessToken || typeof token.accessTokenExpiresAt !== 'number') {
        return token;
      }

      const refreshBufferMs = 30 * 1000;
      const shouldRefresh = Date.now() >= token.accessTokenExpiresAt - refreshBufferMs;
      if (!shouldRefresh) {
        return token;
      }

      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      if (token.error === 'RefreshAccessTokenError' || token.error === 'MissingRefreshToken') {
        // Return an empty session to force "unauthenticated" status, breaking the redirect loop
        return {} as any;
      }

      session.user = {
        ...session.user,
        id: String(token.userId || token.sub || ''),
      };

      session.accessToken = typeof token.accessToken === 'string' ? token.accessToken : undefined;
      session.error = typeof token.error === 'string' ? token.error : undefined;

      return session;
    },
  },
  events: {
    async signOut(message) {
      const token = 'token' in message ? message.token : undefined;

      if (!token?.refreshToken || typeof token.refreshToken !== 'string') {
        return;
      }

      try {
        const refreshCookieName = getRefreshCookieName();
        await fetch(`${getBackendApiBaseUrl()}/auth/logout`, {
          method: 'POST',
          headers: {
            Cookie: `${refreshCookieName}=${encodeURIComponent(token.refreshToken)}`,
          },
          cache: 'no-store',
        });
      } catch {
        // Sign-out should continue even if backend token revocation fails.
      }
    },
  },
  trustHost: true,
});
