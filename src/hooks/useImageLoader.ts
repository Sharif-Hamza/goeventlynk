import { useState, useEffect } from 'react';
import { getStorageUrl, uploadImage, STORAGE_BUCKETS } from '../lib/supabase';

interface UseImageLoaderProps {
  originalUrl?: string | null;
  bucket?: keyof typeof STORAGE_BUCKETS;
  fallbackImageUrl?: string;
}

export const useImageLoader = ({ 
  originalUrl = null,
  bucket = STORAGE_BUCKETS.CLUB_BANNERS,
  fallbackImageUrl = '/default-club-banner.png'
}: UseImageLoaderProps = {}) => {
  const [imageUrl, setImageUrl] = useState<string | null>(originalUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setImageUrl(originalUrl);
  }, [originalUrl]);

  const handleImageUpload = async (file: File | null): Promise<string | null> => {
    console.log('Starting image upload process', { file, bucket });
    
    if (!file) {
      console.log('No file provided, clearing URLs');
      setPreviewUrl(null);
      setImageUrl(null);
      return null;
    }

    // Create a preview URL
    const reader = new FileReader();
    reader.onloadend = () => {
      console.log('Preview URL created');
      setPreviewUrl(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload the file
    try {
      setLoading(true);
      console.log('Uploading to Supabase storage', { bucket });
      const uploadedUrl = await uploadImage(file, bucket);
      console.log('Upload complete', { uploadedUrl });
      
      if (!uploadedUrl) {
        throw new Error('Failed to upload image');
      }
      setImageUrl(uploadedUrl);
      return uploadedUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      setError(error as Error);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { 
    imageUrl, 
    previewUrl,
    error,
    loading,
    handleImageUpload,
    fallbackImageUrl
  };
};
