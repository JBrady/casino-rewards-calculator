import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided in environment variables.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// --- API Functions ---

/**
 * Fetches the tracked casinos for the currently authenticated user.
 * Assumes RLS is enabled and user is logged in.
 */
export const getTrackedCasinos = async () => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  console.log('getTrackedCasinos - User fetch result:', { user, userError });

  if (userError || !user) {
    console.error('Error fetching user:', userError?.message);
    throw new Error(userError?.message || 'User not found');
  }

  const { data, error } = await supabase
    .from('tracked_casinos')
    .select(`
      id,
      casino_name,
      bonus_description,
      collection_interval_hours,
      last_collected_at
    `)
    // RLS automatically handles the user_id filtering
    .order('last_collected_at', { ascending: true, nullsFirst: true }); // Sort by oldest collection first (nulls are considered oldest)

  if (error) {
    console.error('Error fetching tracked casinos:', error.message);
    throw new Error(error.message);
  }

  // Convert string dates from Supabase to Date objects
  return data.map(item => ({
    ...item,
    last_collected_at: item.last_collected_at ? new Date(item.last_collected_at) : null
  }));
};

/**
 * Updates the last_collected_at timestamp for a specific tracked casino entry.
 * @param trackedCasinoId The UUID of the tracked_casinos entry to update.
 */
export const updateLastCollected = async (trackedCasinoId: string) => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error fetching user:', userError?.message);
    throw new Error(userError?.message || 'User not found - cannot update collection');
  }

  const now = new Date().toISOString(); // Get current time in ISO format for Supabase

  const { data, error } = await supabase
    .from('tracked_casinos')
    .update({ last_collected_at: now })
    .eq('id', trackedCasinoId)
    // RLS policy ensures user can only update their own entries
    .select('id') // Select something to confirm the update happened
    .single(); // Expect only one row to be updated

  if (error) {
    console.error('Error updating last collected time:', error.message);
    throw new Error(error.message || 'Failed to update collection time');
  }

  if (!data) {
     console.warn('No tracked casino found with the provided ID or RLS prevented update.');
     throw new Error('Could not find the tracked casino to update, or permission denied.');
  }

  console.log(`Successfully updated last_collected_at for ${trackedCasinoId}`);
  return data; // Return the updated data (just the id in this case)
};

// Type definition for the returned data (optional but good practice)
export interface TrackedCasino {
  id: string;
  casino_name: string;
  bonus_description: string | null;
  collection_interval_hours: number;
  last_collected_at: Date | null;
}
