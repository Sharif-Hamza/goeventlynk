import { useState, useEffect } from 'react';
import axios from 'axios';

export const useImageLoader = (originalUrl) => {
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadImage = async () => {
      try {
        // First, try direct Supabase URL
        const proxyUrl = `/storage/club-banners/${originalUrl.split('/').pop()}`;
        
        const response = await axios.get(proxyUrl, {
          responseType: 'blob',
          headers: {
            'Access-Control-Allow-Origin': '*'
          }
        });

        const blob = new Blob([response.data], { type: 'image/jpeg' });
        const objectUrl = URL.createObjectURL(blob);
        setImageUrl(objectUrl);
      } catch (err) {
        console.error('Image loading error:', err);
        
        // Fallback mechanism
        try {
          const fallbackResponse = await axios.get(originalUrl, {
            responseType: 'blob',
            headers: {
              'Access-Control-Allow-Origin': '*'
            }
          });

          const blob = new Blob([fallbackResponse.data], { type: 'image/jpeg' });
          const objectUrl = URL.createObjectURL(blob);
          setImageUrl(objectUrl);
        } catch (fallbackErr) {
          setError(fallbackErr);
          console.error('Fallback image loading failed:', fallbackErr);
        }
      }
    };

    if (originalUrl) {
      loadImage();
    }

    return () => {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
      }
    };
  }, [originalUrl]);

  return { imageUrl, error };
};
