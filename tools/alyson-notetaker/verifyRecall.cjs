const crypto = require("crypto");

function verifyRequestFromRecall({ secret, headers, payload }) {
  if (!secret || !secret.startsWith("whsec_")) {
    throw new Error("Verification secret is missing or invalid (expected whsec_...)");
  }
  const lower = {};
  for (const [k, v] of Object.entries(headers)) {
    lower[k.toLowerCase()] = typeof v === "string" ? v : Array.isArray(v) ? v.join(",") : "";
  }
  const msgId = lower["webhook-id"] ?? lower["svix-id"];
  const msgTimestamp = lower["webhook-timestamp"] ?? lower["svix-timestamp"];
  const msgSignature = lower["webhook-signature"] ?? lower["svix-signature"];

  if (!msgId || !msgTimestamp || !msgSignature) {
    throw new Error("Missing webhook verification headers");
  }

  const base64Part = secret.slice("whsec_".length);
  const key = Buffer.from(base64Part, "base64");
  const payloadStr = payload == null ? "" : Buffer.isBuffer(payload) ? payload.toString("utf8") : String(payload);
  const toSign = `${msgId}.${msgTimestamp}.${payloadStr}`;
  const expectedSig = crypto.createHmac("sha256", key).update(toSign).digest("base64");

  const passedSigs = msgSignature.split(" ");
  for (const versionedSig of passedSigs) {
    const [version, signature] = versionedSig.split(",");
    if (version !== "v1" || !signature) continue;
    const sigBytes = Buffer.from(signature, "base64");
    const expectedSigBytes = Buffer.from(expectedSig, "base64");
    if (
      sigBytes.length === expectedSigBytes.length &&
      crypto.timingSafeEqual(new Uint8Array(sigBytes), new Uint8Array(expectedSigBytes))
    ) {
      return;
    }
  }
  throw new Error("No matching signature found");
}

module.exports = { verifyRequestFromRecall };

