import React, { useState } from 'react';
import { X, Upload } from 'lucide-react';
import { supabase, uploadImage, getStorageUrl } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { v4 as uuidv4 } from 'uuid';
import toast from 'react-hot-toast';

interface ClubPostModalProps {
  clubId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ClubPostModal({ clubId, onClose, onSuccess }: ClubPostModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [image, setImage] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });

  const handleImageUpload = async (file: File) => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${clubId}-${uuidv4()}.${fileExt}`;

      // Upload image using the utility function
      const publicUrl = await uploadImage(file, 'club-posts', fileName);
      return publicUrl;
    } catch (error) {
      console.error('Error uploading image:', error);
      throw new Error('Failed to upload image');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      let image_url = null;

      if (image) {
        try {
          image_url = await handleImageUpload(image);
          if (!image_url) {
            throw new Error('Failed to get image URL');
          }
        } catch (error) {
          console.error('Image upload error:', error);
          toast.error('Failed to upload image');
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase
        .from('club_posts')
        .insert([{
          club_id: clubId,
          admin_id: user.id,
          title: formData.title,
          description: formData.description,
          image_url,
          created_at: new Date().toISOString()
        }]);

      if (error) throw error;

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

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Post Image (Optional)
            </label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="image"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-purple-600 hover:text-purple-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-purple-500"
                  >
                    <span>Upload a file</span>
                    <input
                      id="image"
                      name="image"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => setImage(e.target.files?.[0] || null)}
                    />
                  </label>
                  <p className="pl-1">or drag and drop</p>
                </div>
                <p className="text-xs text-gray-500">
                  PNG, JPG, GIF up to 10MB
                </p>
                {image && (
                  <p className="text-sm text-purple-600">
                    Selected file: {image.name}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
