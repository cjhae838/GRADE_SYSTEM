const fs = require("fs");

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const adminPassword = process.env.SUPABASE_ADMIN_PASSWORD;
const encryptionKey = process.env.ENCRYPTION_KEY;

const missing = [];
if (!url) missing.push("SUPABASE_URL");
if (!anonKey) missing.push("SUPABASE_ANON_KEY");
if (!adminPassword) missing.push("SUPABASE_ADMIN_PASSWORD");
if (!encryptionKey) missing.push("ENCRYPTION_KEY");

if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

const content = `const SUPABASE_URL = "${url}";
const SUPABASE_ANON_KEY = "${anonKey}";
const ADMIN_PASSWORD = "${adminPassword}";
const ENCRYPTION_KEY = "${encryptionKey}";
`;

fs.writeFileSync("public/config.js", content);
console.log("config.js generated successfully.");
