async function verifyGoogleCredential(credential, clientId) {
  const token = String(credential || "");
  if (!token || token.length > 4096) throw new Error("invalid_token");
  const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("google_verify_failed");
  const data = /** @type {Record<string, any>} */ (await res.json());
  if (data.aud !== clientId) throw new Error("aud_mismatch");
  if (data.email_verified !== "true" && data.email_verified !== true) throw new Error("email_unverified");
  if (!data.email || !data.sub) throw new Error("missing_profile");
  const exp = Number(data.exp) * 1000;
  if (!Number.isFinite(exp) || exp < Date.now()) throw new Error("token_expired");
  return { email: String(data.email), sub: String(data.sub) };
}

module.exports = { verifyGoogleCredential };
