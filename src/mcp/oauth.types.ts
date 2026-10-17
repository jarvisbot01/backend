export class DynamicClientRegistrationDto {
  client_name?: string;
  redirect_uris!: string[];
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: 'none' | 'client_secret_post' | 'client_secret_basic';
  scope?: string;
}

export interface OAuthClient {
  clientId: string;
  clientSecret?: string;
  clientName: string;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  tokenEndpointAuthMethod: string;
  scope: string;
  createdAt: number;
}

export interface AuthorizationCodeGrant {
  code: string;
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256' | 'plain';
  userId: number;
  userEmail: string;
  userRole: string;
  scope: string;
  resource?: string;
  expiresAt: number;
}
