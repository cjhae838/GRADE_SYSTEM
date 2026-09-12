const fs = require("fs");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables.");
  process.exit(1);
}

const content = `const SUPABASE_URL = "${url}";
const SUPABASE_ANON_KEY = "${key}";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
`;

fs.writeFileSync("config.js", content);
console.log("config.js generated successfully.");
