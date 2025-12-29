/**
 * Authentication helpers for parsing auth directives and applying auth to requests
 */

import { useAuthStore, type AuthConfig, type OAuth2Config, type OidcAuthConfig } from "@/stores/authStore";

/**
 * Parse auth configuration from request metadata
 *
 * Supported directives:
 * - # @auth none           - No authentication
 * - # @auth basic          - Basic authentication (requires username/password)
 * - # @auth.username user  - Basic auth username
 * - # @auth.password pass  - Basic auth password
 * - # @auth bearer         - Bearer token (requires token)
 * - # @auth.token xxx      - Bearer token value
 * - # @auth apiKey         - API key authentication
 * - # @auth.header X-Key   - API key header name
 * - # @auth.value xxx      - API key value
 * - # @auth.in header|query - Where to put API key
 * - # @auth oauth2         - OAuth 2.0 (Client Credentials / Password grant)
 * - # @oauth.tokenUrl xxx  - OAuth token endpoint
 * - # @oauth.clientId xxx  - OAuth client ID
 * - # @oauth.clientSecret xxx - OAuth client secret
 * - # @oauth.scopes x y z  - OAuth scopes (space-separated)
 * - # @oauth.grantType client_credentials|password - Grant type
 * - # @oauth.username xxx  - For password grant
 * - # @oauth.password xxx  - For password grant
 * - # @auth oidc           - OpenID Connect (Authorization Code + PKCE)
 * - # @oidc.issuer xxx     - OIDC issuer URL (for discovery)
 * - # @oidc.authorizationEndpoint xxx - Explicit auth endpoint
 * - # @oidc.tokenEndpoint xxx - Explicit token endpoint
 * - # @oidc.clientId xxx   - OIDC client ID
 * - # @oidc.clientSecret xxx - OIDC client secret (optional)
 * - # @oidc.redirectUrl xxx - Redirect URL (must be registered with IdP)
 * - # @oidc.scopes x y z   - OIDC scopes (space-separated)
 */
export function parseAuthFromMetadata(metadata: Record<string, string>): AuthConfig | null {
  const authType = metadata['auth'];

  if (!authType || authType === 'none') {
    return null;
  }

  switch (authType.toLowerCase()) {
    case 'basic': {
      const username = metadata['auth.username'] || '';
      const password = metadata['auth.password'] || '';
      if (!username) {
        console.warn('Basic auth requires username (# @auth.username)');
        return null;
      }
      return {
        type: 'basic',
        username,
        password,
      };
    }

    case 'bearer': {
      const token = metadata['auth.token'] || '';
      if (!token) {
        console.warn('Bearer auth requires token (# @auth.token)');
        return null;
      }
      return {
        type: 'bearer',
        token,
      };
    }

    case 'apikey':
    case 'api-key':
    case 'api_key': {
      const header = metadata['auth.header'] || 'X-API-Key';
      const value = metadata['auth.value'] || '';
      const location = (metadata['auth.in'] || 'header') as 'header' | 'query';
      if (!value) {
        console.warn('API key auth requires value (# @auth.value)');
        return null;
      }
      return {
        type: 'apiKey',
        header,
        value,
        in: location,
      };
    }

    case 'oauth2':
    case 'oauth': {
      const tokenUrl = metadata['oauth.tokenUrl'] || metadata['oauth.token-url'] || '';
      const clientId = metadata['oauth.clientId'] || metadata['oauth.client-id'] || '';

      if (!tokenUrl || !clientId) {
        console.warn('OAuth2 requires tokenUrl and clientId');
        return null;
      }

      const config: OAuth2Config = {
        tokenUrl,
        clientId,
        grantType: (metadata['oauth.grantType'] || metadata['oauth.grant-type'] || 'client_credentials') as OAuth2Config['grantType'],
        clientSecret: metadata['oauth.clientSecret'] || metadata['oauth.client-secret'],
        scopes: metadata['oauth.scopes']?.split(/\s+/).filter(Boolean),
        username: metadata['oauth.username'],
        password: metadata['oauth.password'],
      };

      return {
        type: 'oauth2',
        config,
      };
    }

    case 'oidc':
    case 'openid':
    case 'openid-connect': {
      const clientId = metadata['oidc.clientId'] || metadata['oidc.client-id'] || '';
      const redirectUrl = metadata['oidc.redirectUrl'] || metadata['oidc.redirect-url'] || 'http://localhost:8080/callback';

      if (!clientId) {
        console.warn('OIDC requires clientId (# @oidc.clientId)');
        return null;
      }

      // Either issuer (for discovery) or explicit endpoints are required
      const issuer = metadata['oidc.issuer'];
      const authorizationEndpoint = metadata['oidc.authorizationEndpoint'] || metadata['oidc.authorization-endpoint'];
      const tokenEndpoint = metadata['oidc.tokenEndpoint'] || metadata['oidc.token-endpoint'];

      if (!issuer && !authorizationEndpoint) {
        console.warn('OIDC requires issuer or authorizationEndpoint');
        return null;
      }

      const scopesStr = metadata['oidc.scopes'] || 'openid profile';
      const scopes = scopesStr.split(/\s+/).filter(Boolean);

      const config: OidcAuthConfig = {
        issuer,
        authorizationEndpoint,
        tokenEndpoint,
        clientId,
        redirectUrl,
        scopes,
        clientSecret: metadata['oidc.clientSecret'] || metadata['oidc.client-secret'],
      };

      return {
        type: 'oidc',
        config,
      };
    }

    default:
      console.warn(`Unknown auth type: ${authType}`);
      return null;
  }
}

/**
 * Check if request metadata contains auth directives
 */
export function hasAuthDirective(metadata: Record<string, string>): boolean {
  return 'auth' in metadata;
}

/**
 * Apply authentication to headers based on auth config
 */
export async function applyAuth(
  headers: Record<string, string>,
  authConfig: AuthConfig
): Promise<Record<string, string>> {
  const newHeaders = { ...headers };

  switch (authConfig.type) {
    case 'none':
      break;

    case 'basic': {
      const credentials = `${authConfig.username}:${authConfig.password}`;
      newHeaders['Authorization'] = `Basic ${btoa(credentials)}`;
      break;
    }

    case 'bearer':
      newHeaders['Authorization'] = `Bearer ${authConfig.token}`;
      break;

    case 'apiKey':
      if (authConfig.in === 'header') {
        newHeaders[authConfig.header] = authConfig.value;
      }
      break;

    case 'oauth2': {
      try {
        const token = await useAuthStore.getState().getToken(authConfig.config);
        newHeaders['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        console.error('Failed to get OAuth token:', error);
        throw error;
      }
      break;
    }

    case 'oidc': {
      try {
        const token = await useAuthStore.getState().getOidcToken(authConfig.config);
        newHeaders['Authorization'] = `Bearer ${token}`;
      } catch (error) {
        console.error('Failed to get OIDC token:', error);
        throw error;
      }
      break;
    }
  }

  return newHeaders;
}

/**
 * Apply API key to URL if configured for query parameter
 */
export function applyAuthToUrl(url: string, authConfig: AuthConfig | null): string {
  if (!authConfig || authConfig.type !== 'apiKey' || authConfig.in !== 'query') {
    return url;
  }

  try {
    const urlObj = new URL(url);
    urlObj.searchParams.set(authConfig.header, authConfig.value);
    return urlObj.toString();
  } catch {
    // URL might have variables that aren't substituted yet
    const separator = url.includes('?') ? '&' : '?';
    return `${url}${separator}${encodeURIComponent(authConfig.header)}=${encodeURIComponent(authConfig.value)}`;
  }
}

/**
 * Get a display-friendly description of auth config
 */
export function getAuthDescription(authConfig: AuthConfig | null): string {
  if (!authConfig) {
    return 'No Auth';
  }

  switch (authConfig.type) {
    case 'none':
      return 'No Auth';
    case 'basic':
      return `Basic Auth (${authConfig.username})`;
    case 'bearer':
      return 'Bearer Token';
    case 'apiKey':
      return `API Key (${authConfig.header})`;
    case 'oauth2':
      return `OAuth 2.0 (${authConfig.config.grantType})`;
    case 'oidc':
      return `OIDC (${authConfig.config.issuer || 'custom'})`;
    default:
      return 'Unknown';
  }
}
