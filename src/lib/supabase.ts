import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    storageKey: 'eventlynk-auth',
    storage: localStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit'
  }
});

// Helper function to get storage URL with proper headers
export const getStorageUrl = (bucket: string, path: string): string => {
  const { data } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  if (!data?.publicUrl) {
    console.error('Failed to get public URL for', bucket, path);
    return '';
  }

  // Convert to HTTPS and add download parameter
  const url = new URL(data.publicUrl.replace('http://', 'https://'));
  url.searchParams.set('download', ''); // Forces proper content-disposition
  return url.toString();
};

// Helper function to handle image uploads
export const uploadImage = async (
  file: File,
  bucket: string,
  path: string
): Promise<string> => {
  try {
    // Upload the file
    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Get the public URL
    return getStorageUrl(bucket, path);
  } catch (error) {
    console.error(`Error uploading image to ${bucket}:`, error);
    throw new Error('Failed to upload image');
  }
};