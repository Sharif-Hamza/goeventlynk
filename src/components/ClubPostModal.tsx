import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { supabase, uploadImage, STORAGE_BUCKETS } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';
import { useImageLoader } from '../hooks/useImageLoader';

interface ClubPostModalProps {
  clubId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ClubPostModal({ clubId, onClose, onSuccess }: ClubPostModalProps) {
  const { user } = useAuth();
  const { handleImageUpload, previewUrl, imageUrl, loading: imageLoading } = useImageLoader({
    bucket: STORAGE_BUCKETS.CLUB_POSTS,
    fallbackImageUrl: '/default-post.svg'
  });
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    console.log('File selected:', file);
    setSelectedFile(file);
    await handleImageUpload(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      if (!formData.title.trim() || !formData.description.trim()) {
        toast.error('Please fill in all required fields');
        return;
      }

      // First, ensure the image is uploaded if one was selected
      let finalImageUrl = imageUrl;
      if (selectedFile && !imageUrl) {
        console.log('Uploading image before creating post...');
        finalImageUrl = await handleImageUpload(selectedFile);
        if (!finalImageUrl) {
          throw new Error('Failed to upload image');
        }
      }

      console.log('Creating post with:', { ...formData, imageUrl: finalImageUrl });
      const { error: insertError } = await supabase
        .from('club_posts')
        .insert([
          {
            id: uuidv4(),
            title: formData.title,
            description: formData.description,
            image_url: finalImageUrl,
            club_id: clubId,
            admin_id: user.id,
            user_id: user.id
          },
        ]);

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }

      toast.success('Post created successfully!');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error creating post:', error);
      toast.error('Failed to create post');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Create New Post</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700">
              Post Title
            </label>
            <input
              type="text"
              id="title"
              required
              className="input"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              required
              rows={4}
              className="input"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Post Image
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-lg hover:border-gray-400 transition-colors duration-200">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-purple-600 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      className="sr-only"
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF up to 10MB
                </p>
              </div>
            </div>
          </div>

          {previewUrl && (
            <div className="relative mt-4">
              <img
                src={previewUrl}
                alt="Post preview"
                className="max-w-full h-auto rounded-lg shadow-md"
                loading="lazy"
              />
              <button
                type="button"
                onClick={() => handleImageChange(null)}
                className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading || imageLoading}
              className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 ${
                (loading || imageLoading) ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading || imageLoading ? 'Creating...' : 'Create Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
