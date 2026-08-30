// supabase/functions/_shared/crypto.ts
// Native WebCrypto Ed25519 Signing Utilities for Deno Edge Runtime

export interface LicensePayload {
  user_id: string;
  license_id: string;
  machine_fingerprint: string;
  plan: string;
  status: string;
  issued_at: number;    // Unix timestamp (seconds)
  expires_at: number;   // Unix timestamp (seconds)
  grace_days: number;   // Offline grace period in days (default 14)
}

export interface SignedLicenseToken {
  payload: LicensePayload;
  signature: string;    // Base64 encoded Ed25519 signature
}

/**
 * Import a 32-byte Ed25519 private key from HEX string into WebCrypto CryptoKey
 */
export async function importPrivateKeyFromHex(hexKey: string): Promise<CryptoKey> {
  const cleanHex = hexKey.replace(/^0x/, "").trim();
  const rawBytes = new Uint8Array(
    cleanHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  // PKCS#8 prefix for raw 32-byte Ed25519 private key
  const pkcs8Prefix = new Uint8Array([
    0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
    0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20
  ]);

  const pkcs8Key = new Uint8Array(pkcs8Prefix.length + rawBytes.length);
  pkcs8Key.set(pkcs8Prefix);
  pkcs8Key.set(rawBytes, pkcs8Prefix.length);

  return await crypto.subtle.importKey(
    "pkcs8",
    pkcs8Key,
    { name: "Ed25519" },
    false,
    ["sign"]
  );
}

/**
 * Sign a LicensePayload object using Ed25519 and return base64-encoded string
 */
export async function signLicensePayload(
  payload: LicensePayload,
  privateKeyHex: string
): Promise<string> {
  const privateKey = await importPrivateKeyFromHex(privateKeyHex);
  
  // Canonical JSON serialization
  const payloadJson = JSON.stringify(payload);
  const data = new TextEncoder().encode(payloadJson);

  const signatureBuffer = await crypto.subtle.sign(
    { name: "Ed25519" },
    privateKey,
    data
  );

  const signatureBytes = new Uint8Array(signatureBuffer);
  const signatureBase64 = btoa(String.fromCharCode(...signatureBytes));

  const signedToken: SignedLicenseToken = {
    payload,
    signature: signatureBase64,
  };

  // Return base64 URL-safe token
  const tokenString = JSON.stringify(signedToken);
  return btoa(unescape(encodeURIComponent(tokenString)));
}
