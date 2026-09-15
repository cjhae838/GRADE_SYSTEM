// Deterministic AES-GCM encryption using Web Crypto API
// IV is derived from SHA-256(ENCRYPTION_KEY + plaintext) so same input = same ciphertext

const CryptoModule = (() => {
  const ALGO = "AES-GCM";
  const IV_LENGTH = 12;

  // Convert string to ArrayBuffer
  function strToBuf(str) {
    return new TextEncoder().encode(str);
  }

  // Convert ArrayBuffer to base64
  function bufToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = "";
    bytes.forEach((b) => (binary += String.fromCharCode(b)));
    return btoa(binary);
  }

  // Convert base64 to ArrayBuffer
  function base64ToBuf(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  // Derive a 256-bit AES key from the hex string
  async function getKey() {
    const keyBytes = new Uint8Array(
      ENCRYPTION_KEY.match(/.{1,2}/g).map((byte) => parseInt(byte, 16))
    );
    return crypto.subtle.importKey("raw", keyBytes, { name: ALGO }, false, [
      "encrypt",
      "decrypt",
    ]);
  }

  // Deterministic IV: SHA-256(key + plaintext), first 12 bytes
  async function deriveIV(plaintext) {
    const data = strToBuf(ENCRYPTION_KEY + plaintext);
    const hash = await crypto.subtle.digest("SHA-256", data);
    return new Uint8Array(hash).slice(0, IV_LENGTH);
  }

  // Encrypt plaintext → "iv_base64:ciphertext_base64"
  async function encrypt(plaintext) {
    if (plaintext === null || plaintext === undefined) return null;
    const str = String(plaintext);
    const key = await getKey();
    const iv = await deriveIV(str);
    const encrypted = await crypto.subtle.encrypt(
      { name: ALGO, iv },
      key,
      strToBuf(str)
    );
    return bufToBase64(iv) + ":" + bufToBase64(encrypted);
  }

  // Decrypt "iv_base64:ciphertext_base64" → plaintext
  async function decrypt(encryptedStr) {
    if (!encryptedStr) return null;
    const [ivB64, ctB64] = encryptedStr.split(":");
    if (!ivB64 || !ctB64) return null;
    const key = await getKey();
    const iv = base64ToBuf(ivB64);
    const ct = base64ToBuf(ctB64);
    const decrypted = await crypto.subtle.decrypt(
      { name: ALGO, iv },
      key,
      ct
    );
    return new TextDecoder().decode(decrypted);
  }

  return { encrypt, decrypt };
})();
