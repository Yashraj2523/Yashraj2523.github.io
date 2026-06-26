// config.js
// 1. Create a free project at https://supabase.com
// 2. Run supabase_schema.sql in the SQL editor (creates the content table + locks
//    edit access to a real signed-in user, not a guessable passphrase)
// 3. Paste your Project URL and anon public API key below
// 4. Go to Authentication -> Users -> "Add user" and create exactly ONE account
//    with your own email + a strong password. That is now the only account
//    that can sign in and edit the site (the lock icon, top-right of the nav).
//
// Until you fill these in, the site runs fine off data.js alone, and the
// lock/login icon will tell visitors editing isn't configured on this copy.

const SUPABASE_URL = "https://ysnpinjpnkqgkcdaepyi.supabase.co";          // e.g. "https://xxxxxxxx.supabase.co"
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlzbnBpbmpwbmtxZ2tjZGFlcHlpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIwNTQzOTIsImV4cCI6MjA5NzYzMDM5Mn0._rqeCcJ2YINoML-Nqb7MABM7cicrjqHr8jQXLMmrz8o";     // e.g. "eyJhbGciOi..."