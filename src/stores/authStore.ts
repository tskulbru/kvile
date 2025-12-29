import { create } from "zustand";
import { persist } from "zustand/middleware";
import { open } from "@tauri-apps/plugin-shell";
import {
  oidcStartAuth,
  oidcWaitForCallback,
  oidcExchangeCode,
  oidcRefreshToken as oidcRefreshTokenApi,
  type OidcConfig,
} from "@/lib/tauri";

/**
 * OAuth 2.0 Token response
 */
export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number; // Unix timestamp in ms
  tokenType: string;
  scope?: string;
  idToken?: string;
}

/**
 * OAuth 2.0 Configuration (for client credentials / password grant)
 */
export interface OAuth2Config {
  // Required
  tokenUrl: string;
  clientId: string;
  grantType: 'client_credentials' | 'password' | 'refresh_token';

  // Optional
  clientSecret?: string;
  scopes?: string[];

  // For password grant
  username?: string;
  password?: string;

  // Custom identifier for this config (for caching)
  configId?: string;
}

/**
 * OIDC Configuration (for Authorization Code flow with PKCE)
 */
export interface OidcAuthConfig {
  // Issuer URL for discovery (preferred)
  issuer?: string;
  // Or explicit endpoints
  authorizationEndpoint?: string;
  tokenEndpoint?: string;
  // Required
  clientId: string;
  redirectUrl: string;
  scopes: string[];
  // Optional
  clientSecret?: string;
  extraParams?: Record<string, string>;
  // Custom identifier for this config (for caching)
  configId?: string;
}

/**
 * Auth configuration that can be attached to requests
 */
export type AuthConfig =
  | { type: 'none' }
  | { type: 'basic'; username: string; password: string }
  | { type: 'bearer'; token: string }
  | { type: 'apiKey'; header: string; value: string; in: 'header' | 'query' }
  | { type: 'oauth2'; config: OAuth2Config }
  | { type: 'oidc'; config: OidcAuthConfig };

interface AuthStore {
  // Cached tokens (keyed by config hash)
  tokens: Record<string, OAuthToken>;

  // OIDC auth in progress
  oidcAuthInProgress: boolean;

  // Actions for OAuth2 (client credentials / password grant)
  getToken: (config: OAuth2Config) => Promise<string>;
  refreshToken: (config: OAuth2Config) => Promise<string>;
  fetchNewToken: (config: OAuth2Config) => Promise<OAuthToken>;

  // Actions for OIDC (Authorization Code + PKCE)
  getOidcToken: (config: OidcAuthConfig) => Promise<string>;
  performOidcLogin: (config: OidcAuthConfig) => Promise<OAuthToken>;
  refreshOidcToken: (config: OidcAuthConfig) => Promise<string>;

  // Common actions
  clearToken: (configId: string) => void;
  clearAllTokens: () => void;

  // Check if token is valid
  isTokenValid: (configId: string) => boolean;
}

/**
 * Generate a hash key for an OAuth config (for caching)
 */
function getConfigKey(config: OAuth2Config): string {
  if (config.configId) {
    return config.configId;
  }
  // Create a simple hash from the config
  const key = `${config.tokenUrl}|${config.clientId}|${config.grantType}|${config.scopes?.join(',')}`;
  return btoa(key).slice(0, 32);
}

/**
 * Generate a hash key for an OIDC config (for caching)
 */
function getOidcConfigKey(config: OidcAuthConfig): string {
  if (config.configId) {
    return config.configId;
  }
  // Create a simple hash from the config
  const issuerOrEndpoint = config.issuer || config.authorizationEndpoint || '';
  const key = `oidc|${issuerOrEndpoint}|${config.clientId}|${config.scopes.join(',')}`;
  return btoa(key).slice(0, 32);
}

/**
 * Convert OidcAuthConfig to OidcConfig for Tauri API
 */
function toTauriOidcConfig(config: OidcAuthConfig): OidcConfig {
  return {
    issuer: config.issuer,
    authorization_endpoint: config.authorizationEndpoint,
    token_endpoint: config.tokenEndpoint,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_url: config.redirectUrl,
    scopes: config.scopes,
    extra_params: config.extraParams,
  };
}

/**
 * Fetch a new OAuth token from the token endpoint
 */
async function fetchOAuthToken(config: OAuth2Config): Promise<OAuthToken> {
  const params = new URLSearchParams();
  params.set('grant_type', config.grantType);
  params.set('client_id', config.clientId);

  if (config.clientSecret) {
    params.set('client_secret', config.clientSecret);
  }

  if (config.scopes && config.scopes.length > 0) {
    params.set('scope', config.scopes.join(' '));
  }

  // Password grant specific
  if (config.grantType === 'password') {
    if (config.username) params.set('username', config.username);
    if (config.password) params.set('password', config.password);
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: params,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OAuth token request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  // Calculate expiration time
  let expiresAt: number | undefined;
  if (data.expires_in) {
    // expires_in is in seconds, subtract 60s buffer for safety
    expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    tokenType: data.token_type || 'Bearer',
    expiresAt,
    scope: data.scope,
  };
}

/**
 * Refresh an existing OAuth token
 */
async function refreshOAuthToken(
  config: OAuth2Config,
  refreshToken: string
): Promise<OAuthToken> {
  const params = new URLSearchParams();
  params.set('grant_type', 'refresh_token');
  params.set('refresh_token', refreshToken);
  params.set('client_id', config.clientId);

  if (config.clientSecret) {
    params.set('client_secret', config.clientSecret);
  }

  const response = await fetch(config.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body: params,
  });

  if (!response.ok) {
    throw new Error(`Token refresh failed: ${response.status}`);
  }

  const data = await response.json();

  let expiresAt: number | undefined;
  if (data.expires_in) {
    expiresAt = Date.now() + (data.expires_in - 60) * 1000;
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken, // Keep old refresh token if not provided
    tokenType: data.token_type || 'Bearer',
    expiresAt,
    scope: data.scope,
  };
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      tokens: {},
      oidcAuthInProgress: false,

      isTokenValid: (configId: string) => {
        const token = get().tokens[configId];
        if (!token) return false;
        if (!token.expiresAt) return true; // No expiry = valid
        return token.expiresAt > Date.now();
      },

      getToken: async (config: OAuth2Config) => {
        const key = getConfigKey(config);
        const existing = get().tokens[key];

        // Check if we have a valid cached token
        if (existing) {
          // Token exists and not expired
          if (!existing.expiresAt || existing.expiresAt > Date.now()) {
            return existing.accessToken;
          }

          // Token expired, try refresh if we have refresh token
          if (existing.refreshToken) {
            try {
              return await get().refreshToken(config);
            } catch (error) {
              console.warn('Token refresh failed, fetching new token:', error);
              // Fall through to fetch new token
            }
          }
        }

        // Fetch new token
        const token = await get().fetchNewToken(config);
        return token.accessToken;
      },

      refreshToken: async (config: OAuth2Config) => {
        const key = getConfigKey(config);
        const existing = get().tokens[key];

        if (!existing?.refreshToken) {
          throw new Error('No refresh token available');
        }

        const newToken = await refreshOAuthToken(config, existing.refreshToken);

        set((state) => ({
          tokens: {
            ...state.tokens,
            [key]: newToken,
          },
        }));

        return newToken.accessToken;
      },

      fetchNewToken: async (config: OAuth2Config) => {
        const key = getConfigKey(config);
        const token = await fetchOAuthToken(config);

        set((state) => ({
          tokens: {
            ...state.tokens,
            [key]: token,
          },
        }));

        return token;
      },

      // OIDC methods
      getOidcToken: async (config: OidcAuthConfig) => {
        const key = getOidcConfigKey(config);
        const existing = get().tokens[key];

        // Check if we have a valid cached token
        if (existing) {
          // Token exists and not expired
          if (!existing.expiresAt || existing.expiresAt > Date.now()) {
            return existing.accessToken;
          }

          // Token expired, try refresh if we have refresh token
          if (existing.refreshToken) {
            try {
              return await get().refreshOidcToken(config);
            } catch (error) {
              console.warn('OIDC token refresh failed, starting new login:', error);
              // Fall through to new login
            }
          }
        }

        // Perform interactive OIDC login
        const token = await get().performOidcLogin(config);
        return token.accessToken;
      },

      performOidcLogin: async (config: OidcAuthConfig) => {
        const key = getOidcConfigKey(config);

        // Prevent concurrent auth flows
        if (get().oidcAuthInProgress) {
          throw new Error('OIDC authentication already in progress');
        }

        set({ oidcAuthInProgress: true });

        try {
          const tauriConfig = toTauriOidcConfig(config);

          // Start the auth flow - get auth URL and PKCE params
          const authResult = await oidcStartAuth(tauriConfig);

          // Open browser to authorization URL
          await open(authResult.auth_url);

          // Wait for callback on localhost
          const code = await oidcWaitForCallback(
            config.redirectUrl,
            authResult.state
          );

          // Exchange code for tokens
          const tokenResponse = await oidcExchangeCode(
            tauriConfig,
            code,
            authResult.code_verifier
          );

          // Calculate expiration time
          let expiresAt: number | undefined;
          if (tokenResponse.expires_in) {
            // expires_in is in seconds, subtract 60s buffer
            expiresAt = Date.now() + (tokenResponse.expires_in - 60) * 1000;
          }

          const token: OAuthToken = {
            accessToken: tokenResponse.access_token,
            refreshToken: tokenResponse.refresh_token,
            tokenType: tokenResponse.token_type || 'Bearer',
            expiresAt,
            scope: tokenResponse.scope,
            idToken: tokenResponse.id_token,
          };

          set((state) => ({
            tokens: {
              ...state.tokens,
              [key]: token,
            },
            oidcAuthInProgress: false,
          }));

          return token;
        } catch (error) {
          set({ oidcAuthInProgress: false });
          throw error;
        }
      },

      refreshOidcToken: async (config: OidcAuthConfig) => {
        const key = getOidcConfigKey(config);
        const existing = get().tokens[key];

        if (!existing?.refreshToken) {
          throw new Error('No OIDC refresh token available');
        }

        const tauriConfig = toTauriOidcConfig(config);
        const tokenResponse = await oidcRefreshTokenApi(
          tauriConfig,
          existing.refreshToken
        );

        let expiresAt: number | undefined;
        if (tokenResponse.expires_in) {
          expiresAt = Date.now() + (tokenResponse.expires_in - 60) * 1000;
        }

        const newToken: OAuthToken = {
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token || existing.refreshToken,
          tokenType: tokenResponse.token_type || 'Bearer',
          expiresAt,
          scope: tokenResponse.scope,
          idToken: tokenResponse.id_token,
        };

        set((state) => ({
          tokens: {
            ...state.tokens,
            [key]: newToken,
          },
        }));

        return newToken.accessToken;
      },

      clearToken: (configId: string) => {
        set((state) => {
          const { [configId]: _, ...rest } = state.tokens;
          return { tokens: rest };
        });
      },

      clearAllTokens: () => {
        set({ tokens: {} });
      },
    }),
    {
      name: 'kvile-auth',
      // Only persist tokens, not oidcAuthInProgress
      partialize: (state) => ({ tokens: state.tokens }),
    }
  )
);

/**
 * Helper to generate Basic Auth header value
 */
export function encodeBasicAuth(username: string, password: string): string {
  const credentials = `${username}:${password}`;
  return btoa(credentials);
}

/**
 * Apply auth config to request headers
 */
export async function applyAuthToRequest(
  headers: Record<string, string>,
  auth: AuthConfig
): Promise<Record<string, string>> {
  const newHeaders = { ...headers };

  switch (auth.type) {
    case 'none':
      break;

    case 'basic':
      newHeaders['Authorization'] = `Basic ${encodeBasicAuth(auth.username, auth.password)}`;
      break;

    case 'bearer':
      newHeaders['Authorization'] = `Bearer ${auth.token}`;
      break;

    case 'apiKey':
      if (auth.in === 'header') {
        newHeaders[auth.header] = auth.value;
      }
      // Query params handled separately
      break;

    case 'oauth2':
      const token = await useAuthStore.getState().getToken(auth.config);
      newHeaders['Authorization'] = `Bearer ${token}`;
      break;
  }

  return newHeaders;
}

/**
 * Apply API key to URL if configured for query param
 */
export function applyApiKeyToUrl(url: string, auth: AuthConfig): string {
  if (auth.type === 'apiKey' && auth.in === 'query') {
    const urlObj = new URL(url);
    urlObj.searchParams.set(auth.header, auth.value);
    return urlObj.toString();
  }
  return url;
}
