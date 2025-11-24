// supabase-client.js
// Replace these values if you need a different Supabase project
window.SUPABASE_URL = "https://dwedzobyxaimdbnaxfat.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3ZWR6b2J5eGFpbWRibmF4ZmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NDM2ODMsImV4cCI6MjA3OTUxOTY4M30.yRYmYBz9ByOuUiH5e84x4kJ4IuFNuNWBqIRCU0e4mvA";

(function initSupabase(){
  if (!window.supabase || !window.supabase.createClient) {
    console.warn('Load supabase-js before supabase-client.js: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
    return;
  }
  window.supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
})();
