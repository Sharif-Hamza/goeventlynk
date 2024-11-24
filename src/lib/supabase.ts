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
  },
  global: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'unsafe-none',
      'Cross-Origin-Opener-Policy': 'unsafe-none'
    }
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
    // Create a signed URL with longer expiry
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 60 * 60 * 24); // 24 hour expiry

    if (error || !data?.signedUrl) {
      console.error('Error getting signed URL:', error);
      return '';
    }

    // Return the signed URL
    return data.signedUrl;
  } catch (error) {
    console.error('Error getting storage URL:', error);
    return '';
  }
}

// Helper function to directly download an image
export async function downloadImage(bucket: string, path: string): Promise<Blob | null> {
  try {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);
    
    if (error || !data) {
      console.error('Error downloading image:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error downloading image:', error);
    return null;
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