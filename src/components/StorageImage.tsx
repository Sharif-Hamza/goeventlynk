import { useState, useEffect } from 'react';
import { downloadImage } from '../lib/supabase';

interface StorageImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  bucket: string;
  path: string | null;
  fallbackSrc?: string;
}

export function StorageImage({ bucket, path, fallbackSrc, alt, className, ...props }: StorageImageProps) {
  const [imageSrc, setImageSrc] = useState<string>(fallbackSrc || '');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    async function loadImage() {
      if (!path) {
        setImageSrc(fallbackSrc || '');
        setLoading(false);
        return;
      }

      try {
        const blob = await downloadImage(bucket, path);
        if (blob) {
          const url = URL.createObjectURL(blob);
          setImageSrc(url);
          setError(false);
          return () => URL.revokeObjectURL(url);
        } else {
          throw new Error('Failed to load image');
        }
      } catch (err) {
        console.error('Error loading image:', err);
        setError(true);
        if (fallbackSrc) {
          setImageSrc(fallbackSrc);
        }
      } finally {
        setLoading(false);
      }
    }

    loadImage();
  }, [bucket, path, fallbackSrc]);

  if (loading) {
    return <div className={`animate-pulse bg-gray-200 ${className}`} {...props} />;
  }

  if (error && !fallbackSrc) {
    return <div className={`bg-gray-100 flex items-center justify-center ${className}`} {...props}>
      <span className="text-gray-400">Failed to load image</span>
    </div>;
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      {...props}
    />
  );
}
