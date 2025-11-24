// supabase-client.js
// Put this in your repo root (same folder as index.html, admin.html, display.html)

window.SUPABASE_URL = "https://dwedzobyxaimdbnaxfat.supabase.co";
window.SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3ZWR6b2J5eGFpbWRibmF4ZmF0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NDM2ODMsImV4cCI6MjA3OTUxOTY4M30.yRYmYBz9ByOuUiH5e84x4kJ4IuFNuNWBqIRCU0e4mvA";

// loads SDK if present, then create client
(function initSupabase(){
  if (!window.supabase) {
    console.warn('Supabase SDK not loaded yet. Make sure you include <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script> before this file.');
    return;
  }
  window.supabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
})();
