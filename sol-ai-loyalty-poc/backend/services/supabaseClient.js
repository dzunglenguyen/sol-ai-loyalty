const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "[supabase] Warning: SUPABASE_URL or SUPABASE_KEY is missing in environment variables."
  );
}

const supabase = createClient(supabaseUrl || "", supabaseKey || "");

module.exports = { supabase };
