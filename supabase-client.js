// supabase-client.js
// <-- replace the values below with your Supabase project details if different -->
const SUPABASE_URL = "https://dwedzobyxaimdbnaxfat.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3ZWR6b2J5eGFpbWRibmF4ZmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NDM2ODMsImV4cCI6MjA3OTUxOTY4M30.yRYmYBz9ByOuUiH5e84x4kJ4IuFNuNWBqIRCU0e4mvA";

window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
