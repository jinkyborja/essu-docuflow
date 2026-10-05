import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_SECRET_KEY, SUPABASE_PUBLISHABLE_KEY } from '$env/static/private';

// Use secret (service role) key for server-side storage operations.
// Get it from: Supabase Dashboard → Project Settings → API → service_role key
// Add to .env as SUPABASE_SECRET_KEY=
const key = SUPABASE_SECRET_KEY || SUPABASE_PUBLISHABLE_KEY;
export const supabase = createClient(SUPABASE_URL, key);
