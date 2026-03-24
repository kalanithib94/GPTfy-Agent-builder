import { createHash, randomBytes } from "crypto";

/** RFC 7636 PKCE code_verifier (high-entropy, URL-safe). */
export function createPkceVerifier(): string {
  return randomBytes(32).toString("base64url");
}

/** S256 code_challenge from verifier. */
export function createPkceChallengeS256(verifier: string): string {
  return createHash("sha256").update(verifier, "utf8").digest("base64url");
}
