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

  // --- ADDITION: Update user_form_data.last_collection_time ---
  if (user) {
    const { error: userFormDataError } = await supabase
      .from('user_form_data')
      .update({ last_collection_time: now })
      .eq('user_id', user.id);

    if (userFormDataError) {
      // Log this error but don't necessarily stop the process, 
      // as the main casino update succeeded. Consider if this should throw.
      console.error(
        `Error updating user_form_data.last_collection_time for user ${user.id}:`,
        userFormDataError.message
      );
      // Optionally throw an error here if this update is critical:
      // throw new Error(`Failed to update user profile collection time: ${userFormDataError.message}`);
    } else {
      console.log(`Successfully updated user_form_data.last_collection_time for user ${user.id}`);
    }
  } else {
      console.warn('Cannot update user_form_data: user object not available.')
  }
  // --- END ADDITION ---

  // Fetch casino name for better activity log description
  let casinoName = `casino ID: ${trackedCasinoId}`; // Default description
  try {
    const { data: casinoData, error: nameError } = await supabase
      .from('tracked_casinos')
      .select('casino_name')
      .eq('id', trackedCasinoId)
      .single();

    if (nameError) {
      console.error('Error fetching casino name for activity log:', nameError);
    } else if (casinoData) {
      casinoName = casinoData.casino_name;
    }
  } catch (e) {
    console.error('Exception fetching casino name:', e);
  }

  // Also log this activity
  if (user) {
    addActivityLog({ // Use the fetched name
      user_id: user.id,
      activity_type: 'collection_made',
      description: `Collected from ${casinoName}`,
      related_casino_id: trackedCasinoId,
    }).catch(logError => {
      // Log errors from activity logging but don't block the primary action
      console.error('Failed to log collection activity:', logError);
    });
  }

  return data; // Return the updated data (just the id in this case)
};

/**
 * Updates an existing tracked casino entry for the current user.
 * @param trackedCasinoId The ID of the casino entry to update.
 * @param updates An object containing the fields to update (e.g., { casino_name: 'New Name' }).
 */
export const updateTrackedCasino = async (
  trackedCasinoId: string,
  updates: Partial<Omit<TrackedCasino, 'id' | 'user_id' | 'created_at' | 'last_collected_at'>>
): Promise<TrackedCasino> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error fetching user:', userError?.message);
    throw new Error(userError?.message || 'User not found - cannot update casino');
  }

  // Only allow updating specific fields - prevent changing user_id, id, etc.
  const allowedUpdates: Partial<TrackedCasino> = {};
  if (updates.casino_name !== undefined) allowedUpdates.casino_name = updates.casino_name;
  if (updates.collection_interval_hours !== undefined) allowedUpdates.collection_interval_hours = updates.collection_interval_hours;
  if (updates.bonus_description !== undefined) allowedUpdates.bonus_description = updates.bonus_description;
  // Add other updatable fields here if needed

  if (Object.keys(allowedUpdates).length === 0) {
    console.warn('No valid fields provided for update.');
    // Decide how to handle this - throw error or return existing data?
    // For now, let's throw an error to indicate nothing was done.
    throw new Error('No valid fields provided for update.');
  }

  const { data, error } = await supabase
    .from('tracked_casinos')
    .update(allowedUpdates)
    .eq('id', trackedCasinoId)
    .eq('user_id', user.id) // RLS handles this, but explicit check is safer
    .select()
    .single(); // Return the updated record

  if (error) {
    console.error('Error updating tracked casino:', error.message);
    throw new Error(error.message || 'Failed to update tracked casino');
  }

  if (!data) {
    throw new Error('Updated casino data not returned.');
  }

  console.log(`Successfully updated tracked casino: ${trackedCasinoId}`);
  return data;
};

/**
 * Adds a new entry to the activity log for the current user.
 * @param logData Object containing activity_type, description, and optional related_casino_id
 */
export const addActivityLog = async (
  logData: Omit<ActivityLog, 'id' | 'created_at' | 'user_id'> & { user_id: string }
) => {
  const { data, error } = await supabase
    .from('activity_log')
    .insert([logData]) // user_id must be provided here to satisfy RLS CHECK
    .select()
    .single();

  if (error) {
    console.error('Error adding activity log:', error.message);
    // Don't throw here, logging might be non-critical? Or re-evaluate based on importance.
    // throw new Error(error.message || 'Failed to add activity log');
  }

  return data;
};

/**
 * Fetches the most recent activity logs for the current user.
 * @param limit Max number of log entries to return (default 20)
 */
export const getActivityLog = async (limit: number = 20): Promise<ActivityLog[]> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error fetching user:', userError?.message);
    throw new Error(userError?.message || 'User not found - cannot fetch activity log');
  }

  // RLS policy handles filtering by user_id = auth.uid()
  const { data, error } = await supabase
    .from('activity_log')
    .select('id, created_at, activity_type, description, related_casino_id')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('Error fetching activity log:', error.message);
    throw new Error(error.message || 'Failed to fetch activity log');
  }

  // Ensure data is not null before returning
  return data || [];
};

// --- Casino Retrieval Functions ---

/**
 * Fetches a single tracked casino by its ID for the current user.
 * @param trackedCasinoId The ID of the casino to fetch.
 */
export const getTrackedCasinoById = async (trackedCasinoId: string): Promise<TrackedCasino | null> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error fetching user:', userError?.message);
    throw new Error(userError?.message || 'User not found - cannot fetch casino');
  }

  const { data, error } = await supabase
    .from('tracked_casinos')
    .select('*')
    .eq('id', trackedCasinoId)
    .eq('user_id', user.id) // RLS handles this, but explicit check is safer
    .single(); // Expecting only one result

  if (error) {
    // If error is 'PGRST116', it means no rows found, which is not necessarily an error here.
    if (error.code === 'PGRST116') {
      console.log(`Casino with ID ${trackedCasinoId} not found for this user.`);
      return null;
    } else {
      console.error('Error fetching tracked casino by ID:', error.message);
      throw new Error(error.message || 'Failed to fetch tracked casino');
    }
  }

  return data;
};

// --- Casino Management Functions (Delete/Update) ---

/**
 * Deletes a tracked casino entry for the current user.
 * @param trackedCasinoId The ID of the casino entry to delete.
 */
export const deleteTrackedCasino = async (trackedCasinoId: string): Promise<void> => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error fetching user:', userError?.message);
    throw new Error(userError?.message || 'User not found - cannot delete casino');
  }

  // RLS policy ensures user can only delete their own entries
  const { error } = await supabase
    .from('tracked_casinos')
    .delete()
    .eq('id', trackedCasinoId)
    .eq('user_id', user.id); // Explicitly check user_id for extra safety, though RLS should cover it

  if (error) {
    console.error('Error deleting tracked casino:', error.message);
    throw new Error(error.message || 'Failed to delete tracked casino');
  }

  console.log(`Successfully deleted tracked casino: ${trackedCasinoId}`);

  // Optionally log this activity (consider if needed, might clutter log)
  // addActivityLog({
  //   user_id: user.id,
  //   activity_type: 'casino_deleted',
  //   description: `Deleted tracked casino ID: ${trackedCasinoId}`,
  //   related_casino_id: trackedCasinoId, // This ID won't link anywhere after deletion
  // }).catch(logError => {
  //   console.error('Failed to log casino deletion activity:', logError);
  // });
};

// --- Type Definitions ---

export interface TrackedCasino {
  id: string;
  casino_name: string;
  bonus_description: string | null;
  collection_interval_hours: number;
  last_collected_at: Date | null;
}

// Type for the data needed to add a new casino
export interface NewTrackedCasinoData {
  casino_name: string;
  bonus_description: string | null;
  collection_interval_hours: number;
  // user_id will be handled automatically by RLS default
}

/**
 * Adds a new casino to be tracked for the current user.
 * @param casinoData Object containing casino_name, bonus_description, collection_interval_hours
 */
export const addTrackedCasino = async (casinoData: NewTrackedCasinoData) => {
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error('Error fetching user:', userError?.message);
    throw new Error(userError?.message || 'User not found - cannot add casino');
  }

  // Prepare the data for insertion. user_id is not needed here
  // if the RLS policy for INSERT has a default value like auth.uid().
  // If not, we would need to add user.id here.
  const { data, error } = await supabase
    .from('tracked_casinos')
    .insert([{
      ...casinoData,
      user_id: user.id // Explicitly set the user_id
    }])
    .select()
    .single(); // Assuming we insert one row and want it returned

  if (error) {
    console.error('Error adding tracked casino:', error.message);
    // Provide more specific error feedback if possible (e.g., duplicate name?)
    if (error.message.includes('duplicate key value violates unique constraint')) {
       throw new Error(`Casino "${casinoData.casino_name}" is already being tracked.`);
    }
    throw new Error(error.message || 'Failed to add casino');
  }

  console.log('Successfully added casino:', data);

  if (data && user) { // Check if data (new casino row) and user exist
    addActivityLog({
      user_id: user.id,
      activity_type: 'casino_added',
      description: `Tracked new casino: ${data.casino_name}`,
      related_casino_id: data.id, // Use the ID of the newly created casino row
    }).catch(logError => {
      // Log errors from activity logging but don't block the primary action
      console.error('Failed to log casino added activity:', logError);
    });
  }

  return data;
};

// --- Activity Log Types and Functions ---

export interface ActivityLog {
  id: string;
  created_at: string; // Comes as ISO string
  activity_type: string;
  description: string;
  related_casino_id: string | null;
}
