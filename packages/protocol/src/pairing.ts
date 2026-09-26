/**
 * Pairing & OAuth 2.1 Wire DTOs (PRD FR-602, FR-603, FR-606, TRD §8).
 * Shared contracts between extension, relay, and MCP clients.
 */

import type { TransportMode } from './envelope.js';

export interface PairBeginRequest {
  devicePubKey: string; // Base64 encoded X25519 public key
  label: string;
  mode: TransportMode;
}

export interface PairBeginResponse {
  code: string; // Short-lived pairing code (<= 5 min TTL, PRD FR-606)
  expiresAt: number;
  relayUrl: string;
}

export interface PairConfirmRequest {
  code: string;
  devicePubKey: string;
  signature: string;
}

// RFC 7591 Dynamic Client Registration (DCR) payload
export interface OAuthClientRegistration {
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  token_endpoint_auth_method: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string | undefined;
  scope?: string | undefined;
}

// RFC 9728 OAuth Protected Resource Metadata
export interface OAuthResourceMetadata {
  resource: string;
  authorization_servers: string[];
  scopes_supported: string[];
}

// RFC 8414 OAuth 2.0 Authorization Server Metadata
export interface OAuthAuthorizationServerMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  response_types_supported: string[];
  grant_types_supported: string[];
}
