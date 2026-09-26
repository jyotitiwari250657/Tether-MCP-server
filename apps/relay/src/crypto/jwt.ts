// TRD §8.5: OAuth 2.1 JWT Access Token Signing, Verification & JWKS via jose
import { type JWK, SignJWT, exportJWK, generateKeyPair, importJWK, jwtVerify } from 'jose';

export interface TokenClaims {
  sub: string;
  client_id: string;
  device_id: string;
  scope: string;
  iss: string;
  aud: string;
  exp?: number | undefined;
  iat?: number | undefined;
}

let cachedSigningKey: { privateKey: CryptoKey; publicKey: CryptoKey; jwk: JWK } | null = null;

export async function getSigningKey(configuredPrivJwk?: string, configuredPubJwk?: string) {
  if (configuredPrivJwk && configuredPubJwk) {
    try {
      const privJwkObj = JSON.parse(configuredPrivJwk) as JWK;
      const pubJwkObj = JSON.parse(configuredPubJwk) as JWK;
      const privateKey = (await importJWK(privJwkObj, 'EdDSA')) as CryptoKey;
      const publicKey = (await importJWK(pubJwkObj, 'EdDSA')) as CryptoKey;
      return { privateKey, publicKey, jwk: pubJwkObj };
    } catch {
      // fallback to generated
    }
  }

  if (cachedSigningKey) {
    return cachedSigningKey;
  }

  const { privateKey, publicKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const pubJwk = await exportJWK(publicKey);
  pubJwk.kid = 'tether-key-1';
  pubJwk.use = 'sig';
  pubJwk.alg = 'EdDSA';

  cachedSigningKey = {
    privateKey: privateKey as CryptoKey,
    publicKey: publicKey as CryptoKey,
    jwk: pubJwk,
  };
  return cachedSigningKey;
}

export async function signAccessToken(
  claims: Omit<TokenClaims, 'iss' | 'aud'>,
  issuer: string,
  audience: string,
  expiresInSeconds = 3600,
  privJwk?: string,
  pubJwk?: string,
): Promise<string> {
  const { privateKey, jwk } = await getSigningKey(privJwk, pubJwk);

  return await new SignJWT({
    sub: claims.sub,
    client_id: claims.client_id,
    device_id: claims.device_id,
    scope: claims.scope,
  })
    .setProtectedHeader({ alg: 'EdDSA', kid: jwk.kid ?? 'tether-key-1' })
    .setIssuedAt()
    .setIssuer(issuer)
    .setAudience(audience)
    .setExpirationTime(`${expiresInSeconds}s`)
    .sign(privateKey);
}

export async function verifyAccessToken(
  token: string,
  issuer: string,
  audience: string,
  pubJwk?: string,
): Promise<TokenClaims | null> {
  try {
    const { publicKey } = await getSigningKey(undefined, pubJwk);
    const { payload } = await jwtVerify(token, publicKey, {
      issuer,
      audience,
    });

    return {
      sub: (payload.sub as string) ?? '',
      client_id: (payload.client_id as string) ?? '',
      device_id: (payload.device_id as string) ?? '',
      scope: (payload.scope as string) ?? '',
      iss: (payload.iss as string) ?? '',
      aud: (Array.isArray(payload.aud) ? payload.aud[0] : payload.aud) ?? '',
      exp: payload.exp,
      iat: payload.iat,
    };
  } catch {
    return null;
  }
}

export async function getJwks(pubJwk?: string): Promise<{ keys: JWK[] }> {
  const { jwk } = await getSigningKey(undefined, pubJwk);
  return {
    keys: [jwk],
  };
}
