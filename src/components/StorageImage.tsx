import { useState, useEffect } from 'react';
import { getStorageUrl } from '../lib/supabase';
import { Skeleton } from './ui/skeleton';

interface StorageImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  bucket: string;
  path: string | null;
  fallback?: string;
  retryCount?: number;
  timeout?: number;
}

export function StorageImage({ 
  bucket, 
  path, 
  fallback = '', 
  className = '',
  alt = '',
  retryCount = 2,
  timeout = 5000,
  ...props 
}: StorageImageProps) {
  const [imageUrl, setImageUrl] = useState<string>(fallback);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retries, setRetries] = useState(0);

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    const loadImage = async () => {
      if (!path || !bucket) {
        if (mounted) {
          setImageUrl(fallback);
          setLoading(false);
        }
        return;
      }

      // Handle external URLs
      if (path.startsWith('http')) {
        try {
          new URL(path);
          if (mounted) {
            setImageUrl(path);
            setLoading(false);
          }
          return;
        } catch {
          if (mounted) {
            setImageUrl(fallback);
            setError(true);
            setLoading(false);
          }
          return;
        }
      }

      // Get Supabase URL
      const resolvedUrl = getStorageUrl(bucket, path);
      
      if (!resolvedUrl) {
        console.error('Failed to resolve Supabase URL', { bucket, path });
        if (mounted) {
          setImageUrl(fallback);
          setError(true);
          setLoading(false);
        }
        return;
      }

      // Create new image object
      const img = new Image();

      // Set up load handlers
      const handleLoad = () => {
        clearTimeout(timeoutId);
        if (mounted) {
          setImageUrl(resolvedUrl);
          setLoading(false);
          setError(false);
        }
      };

      const handleError = () => {
        clearTimeout(timeoutId);
        console.error('Image load failed', { url: resolvedUrl, bucket, path });
        
        // Retry logic
        if (retries < retryCount) {
          setRetries(prev => prev + 1);
          loadImage(); // Retry loading
        } else {
          if (mounted) {
            setImageUrl(fallback);
            setError(true);
            setLoading(false);
          }
        }
      };

      // Set timeout
      timeoutId = setTimeout(() => {
        img.onload = null;
        img.onerror = null;
        if (mounted) {
          handleError();
        }
      }, timeout);

      // Attach handlers and start loading
      img.onload = handleLoad;
      img.onerror = handleError;
      img.src = resolvedUrl;
    };

    // Start loading process
    setLoading(true);
    setError(false);
    loadImage();

    // Cleanup
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [bucket, path, fallback, retryCount, timeout]);

  if (loading) {
    return <Skeleton className={`${className} min-h-[100px]`} />;
  }

  return (
    <img
      src={imageUrl}
      alt={alt}
      className={`${className} ${error ? 'opacity-50' : ''}`}
      {...props}
    />
  );
}
