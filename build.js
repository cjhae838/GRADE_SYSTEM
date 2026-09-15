const fs = require("fs");

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
const adminAccounts = process.env.ADMIN_ACCOUNTS;
const encryptionKey = process.env.ENCRYPTION_KEY;

const missing = [];
if (!url) missing.push("SUPABASE_URL");
if (!anonKey) missing.push("SUPABASE_ANON_KEY");
if (!adminAccounts) missing.push("ADMIN_ACCOUNTS");
if (!encryptionKey) missing.push("ENCRYPTION_KEY");

if (missing.length > 0) {
  console.error(`Missing environment variables: ${missing.join(", ")}`);
  process.exit(1);
}

// Validate format: "name1:pass1,name2:pass2"
const accounts = adminAccounts.split(",").map((a) => {
  const [name, password] = a.trim().split(":");
  if (!name || !password) {
    console.error(`Invalid ADMIN_ACCOUNTS format: "${a.trim()}". Expected "name:password".`);
    process.exit(1);
  }
  return { name: name.trim(), password: password.trim() };
});

const content = `const SUPABASE_URL = "${url}";
const SUPABASE_ANON_KEY = "${anonKey}";
const ADMIN_ACCOUNTS = ${JSON.stringify(accounts)};
const ENCRYPTION_KEY = "${encryptionKey}";
`;

fs.writeFileSync("public/config.js", content);
console.log("config.js generated successfully.");
