import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

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

// Storage bucket names
export const STORAGE_BUCKETS = {
  CLUB_BANNERS: 'club-banners',
  CLUB_POSTS: 'club-posts'
} as const;

// Helper function to get a storage URL for an image
export async function getStorageUrl(bucket: string, path: string | null): Promise<string> {
  if (!path) return '';
  
  try {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    if (!data?.publicUrl) {
      throw new Error('Failed to get public URL');
    }

    // Transform the URL to use direct storage access
    const url = new URL(data.publicUrl);
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
  } catch (error) {
    console.error('Error getting storage URL:', error);
    return '';
  }
}

// Helper function to upload an image
export async function uploadImage(file: File, bucket: string): Promise<string | null> {
  try {
    const fileExt = file.name.split('.').pop();
    const filePath = `${uuidv4()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });

    if (uploadError) throw uploadError;
    return filePath;
  } catch (error) {
    console.error('Error uploading image:', error);
    return null;
  }
}

// Helper function to handle image URLs with fallback
export function getImageUrlWithFallback(bucket: string, path: string | null, defaultImage: string): string {
  if (!path) return defaultImage;
  return getStorageUrl(bucket, path).then(url => url || defaultImage);
}