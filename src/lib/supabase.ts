import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

// Storage bucket names
export const STORAGE_BUCKETS = {
  CLUB_BANNERS: 'club-banners',
  CLUB_POSTS: 'club-posts'
} as const;

// Helper function to get a storage URL for an image
export function getStorageUrl(bucket: string, path: string | null): string {
  if (!path) return '';

  // If it's already a full URL, return it directly
  if (path.startsWith('http')) {
    try {
      const url = new URL(path);
      if (url.hostname === new URL(supabaseUrl).hostname) {
        return path;
      }
    } catch {
      console.error('Invalid URL provided', path);
      return '';
    }
  }

  // Remove any storage prefixes if present
  const cleanPath = path
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/^storage\/v1\/object\/public\//i, '')
    .replace(new RegExp(`^${bucket}/`, 'i'), '');

  // Security check
  if (!cleanPath || cleanPath.includes('..') || cleanPath.startsWith('/')) {
    console.error('Invalid path', { original: path, cleaned: cleanPath });
    return '';
  }

  // Return the final URL
  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${cleanPath}`;
}

// Helper function to extract image name from full path
export function extractImageName(fullPath: string): string {
  // Extract the last part of the path
  const parts = fullPath.split('/');
  return parts[parts.length - 1].split('?')[0];
}

// Enhanced error handling for Supabase interactions
export async function safeSupabaseDownload(
  bucket: string, 
  path: string, 
  options?: { download?: boolean }
) {
  try {
    const resolvedUrl = getStorageUrl(bucket, path);
    
    if (!resolvedUrl) {
      console.error('Failed to resolve Supabase URL', { bucket, path });
      return null;
    }

    const response = await fetch(resolvedUrl, {
      method: 'GET',
      headers: {
        'Accept': 'image/*',
        'Origin': window.location.origin
      }
    });

    if (!response.ok) {
      console.error('Supabase download failed', {
        status: response.status,
        statusText: response.statusText,
        url: resolvedUrl
      });
      return null;
    }

    return options?.download 
      ? await response.blob() 
      : resolvedUrl;
  } catch (error) {
    console.error('Supabase download error', { error, bucket, path });
    return null;
  }
}

// Helper function to upload an image
export async function uploadImage(file: File, bucket: string): Promise<string | null> {
  try {
    console.log('uploadImage called with:', { fileName: file.name, fileType: file.type, bucket });
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('Invalid file type. Only images are allowed.');
    }

    // Generate unique filename
    const fileExt = file.name.split('.').pop()?.toLowerCase();
    const fileName = `${uuidv4()}.${fileExt}`;
    console.log('Generated filename:', fileName);

    // Upload file
    console.log('Starting Supabase upload...');
    const { error: uploadError, data } = await supabase.storage
      .from(bucket)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw uploadError;
    }
    
    console.log('Upload successful, getting public URL');
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(fileName);

    console.log('Public URL generated:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('Error in uploadImage:', error);
    return null;
  }
}

// Helper function to delete an image
export async function deleteImage(path: string, bucket: string): Promise<boolean> {
  try {
    const fileName = extractImageName(path);
    const { error } = await supabase.storage
      .from(bucket)
      .remove([fileName]);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('Error deleting image:', error);
    return false;
  }
}