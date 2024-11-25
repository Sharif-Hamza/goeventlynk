import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase, uploadImage, STORAGE_BUCKETS } from '../lib/supabase';
import { useImageLoader } from '../hooks/useImageLoader';
import { useAuth } from '../context/AuthContext';
import { Building, Users, Bell, Calendar, Image, Trash2, Camera, Heart, ThumbsUp, Star } from 'lucide-react';
import ClubPostModal from '../components/ClubPostModal';
import toast from 'react-hot-toast';
import { v4 as uuidv4 } from 'uuid';

interface Club {
  id: string;
  name: string;
  description: string;
  created_at: string;
  admin_id: string;
  banner_url?: string;
}

interface ClubPost {
  id: string;
  title: string;
  description: string;
  image_url?: string;
  created_at: string;
  admin_id: string;
  club_id: string;
}

interface ClubPostReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction_type: string;
  created_at: string;
}

interface ClubStatistics {
  club_id: string;
  follower_count: number;
  post_count: number;
  event_count: number;
  announcement_count: number;
}

const REACTION_TYPES = [
  {
    type: 'LIKE',
    icon: ThumbsUp,
    activeColor: 'text-blue-500',
    hoverColor: 'hover:text-blue-500',
    bgColor: 'bg-blue-50',
  },
  {
    type: 'HEART',
    icon: Heart,
    activeColor: 'text-red-500',
    hoverColor: 'hover:text-red-500',
    bgColor: 'bg-red-50',
  },
  {
    type: 'STAR',
    icon: Star,
    activeColor: 'text-yellow-500',
    hoverColor: 'hover:text-yellow-500',
    bgColor: 'bg-yellow-50',
  },
];

export default function Clubs() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedClub, setSelectedClub] = useState<string | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch clubs
  const { data: clubs, isLoading } = useQuery({
    queryKey: ['clubs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clubs')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Club[];
    },
  });

  // Fetch club statistics
  const { data: clubStats } = useQuery({
    queryKey: ['club-statistics'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('club_statistics')
        .select('*');
      if (error) throw error;
      return data as ClubStatistics[];
    },
  });

  // Fetch followed clubs
  const { data: followedClubs } = useQuery({
    queryKey: ['followed-clubs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('club_followers')
        .select('club_id')
        .eq('user_id', user.id);
      if (error) throw error;
      return data.map(f => f.club_id);
    },
    enabled: !!user,
  });

  // Fetch club posts
  const { data: clubPosts } = useQuery({
    queryKey: ['club-posts', selectedClub],
    queryFn: async () => {
      if (!selectedClub) return [];
      const { data, error } = await supabase
        .from('club_posts')
        .select('*')
        .eq('club_id', selectedClub)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ClubPost[];
    },
    enabled: !!selectedClub,
  });

  // Fetch post reactions with counts
  const { data: postReactions } = useQuery({
    queryKey: ['post-reactions'],
    queryFn: async () => {
      const { data: reactions, error } = await supabase
        .from('club_post_reactions')
        .select(`
          id,
          post_id,
          user_id,
          reaction_type,
          created_at
        `);
      if (error) throw error;
      return reactions;
    },
  });

  // Follow/unfollow mutation
  const followMutation = useMutation({
    mutationFn: async ({ clubId, action }: { clubId: string; action: 'follow' | 'unfollow' }) => {
      if (!user) throw new Error('Must be logged in');
      if (action === 'follow') {
        const { error } = await supabase
          .from('club_followers')
          .insert({ user_id: user.id, club_id: clubId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('club_followers')
          .delete()
          .eq('user_id', user.id)
          .eq('club_id', clubId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followed-clubs'] });
      queryClient.invalidateQueries({ queryKey: ['club-statistics'] });
    },
  });

  // Delete club mutation
  const deleteMutation = useMutation({
    mutationFn: async (clubId: string) => {
      const { error } = await supabase
        .from('clubs')
        .delete()
        .eq('id', clubId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      toast.success('Club deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete club');
      console.error('Delete error:', error);
    },
  });

  // Update banner mutation
  const updateBannerMutation = useMutation({
    mutationFn: async ({ clubId, file }: { clubId: string; file: File }) => {
      try {
        const filePath = await uploadImage(file, STORAGE_BUCKETS.CLUB_BANNERS);
        if (!filePath) {
          throw new Error('Failed to upload banner');
        }

        // Update club record with the file path
        const { error: updateError } = await supabase
          .from('clubs')
          .update({ banner_url: filePath })
          .eq('id', clubId);

        if (updateError) throw updateError;

        // Get the signed URL for immediate display
        const url = filePath;
        if (url) {
          return url;
        }

        return filePath;
      } catch (error) {
        console.error('Error updating banner:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clubs'] });
      toast.success('Club banner updated successfully');
    },
    onError: (error) => {
      console.error('Error updating banner:', error);
      toast.error('Failed to update club banner');
    },
  });

  // Delete post mutation
  const deletePostMutation = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from('club_posts')
        .delete()
        .eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['club-posts'] });
      toast.success('Post deleted successfully');
    },
    onError: (error) => {
      toast.error('Failed to delete post');
      console.error('Delete error:', error);
    },
  });

  // Toggle reaction mutation
  const toggleReactionMutation = useMutation({
    mutationFn: async ({ postId, reactionType }: { postId: string; reactionType: string }) => {
      if (!user) throw new Error('Must be logged in');

      // Check if user already has this specific reaction
      const { data: existingReactions, error: fetchError } = await supabase
        .from('club_post_reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .eq('reaction_type', reactionType);

      if (fetchError) throw fetchError;

      if (existingReactions && existingReactions.length > 0) {
        // Remove this specific reaction type
        const { error: deleteError } = await supabase
          .from('club_post_reactions')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', user.id)
          .eq('reaction_type', reactionType);

        if (deleteError) throw deleteError;
      } else {
        // Add new reaction of this type
        const { error: insertError } = await supabase
          .from('club_post_reactions')
          .insert({
            post_id: postId,
            user_id: user.id,
            reaction_type: reactionType
          });

        if (insertError) {
          console.error('Insert error:', insertError);
          throw insertError;
        }
      }

      // Refetch to update UI
      await queryClient.invalidateQueries({ queryKey: ['post-reactions'] });
    },
    onError: (error: any) => {
      console.error('Reaction error:', error);
      toast.error('Failed to update reaction');
    },
  });

  const handleBannerUpload = async (clubId: string, file: File) => {
    updateBannerMutation.mutate({ clubId, file });
  };

  const handleFollowToggle = (clubId: string) => {
    if (!user) return;
    const action = followedClubs?.includes(clubId) ? 'unfollow' : 'follow';
    followMutation.mutate({ clubId, action });
  };

  const handleDeleteClub = (clubId: string) => {
    if (window.confirm('Are you sure you want to delete this club?')) {
      deleteMutation.mutate(clubId);
    }
  };

  const handleDeletePost = (postId: string) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      deletePostMutation.mutate(postId);
    }
  };

  const getClubStats = (clubId: string) => {
    return clubStats?.find(stats => stats.club_id === clubId) || {
      follower_count: 0,
      post_count: 0,
      event_count: 0,
      announcement_count: 0,
    };
  };

  const getPostReactions = (postId: string) => {
    if (!postReactions) return {};
    
    // Group reactions by type and count them
    const reactions = postReactions
      .filter(r => r.post_id === postId)
      .reduce((acc, reaction) => {
        if (!acc[reaction.reaction_type]) {
          acc[reaction.reaction_type] = {
            count: 0,
            userReacted: false
          };
        }
        acc[reaction.reaction_type].count++;
        if (user && reaction.user_id === user.id) {
          acc[reaction.reaction_type].userReacted = true;
        }
        return acc;
      }, {} as Record<string, { count: number; userReacted: boolean }>);
    
    return reactions;
  };

  const getUserReaction = (postId: string) => {
    if (!user || !postReactions) return null;
    const reaction = postReactions.find(
      r => r.post_id === postId && r.user_id === user.id
    );
    return reaction?.reaction_type || null;
  };

  const handleReaction = (postId: string, reactionType: string) => {
    if (!user) {
      toast.error('Please log in to react to posts');
      return;
    }
    toggleReactionMutation.mutate({ postId, reactionType });
  };

  const isClubAdmin = (club: Club) => {
    if (!user) return false;
    return user.is_admin || (user.role === 'club_admin' && user.club_id === club.id);
  };

  const isPostAdmin = (post: ClubPost) => {
    if (!user) return false;
    return user.is_admin || (user.role === 'club_admin' && user.club_id === post.club_id);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Building className="w-8 h-8 text-purple-700" />
        <h1 className="text-3xl font-bold">Clubs</h1>
      </div>

      <div className="grid gap-6">
        {clubs?.map(club => {
          const { imageUrl: bannerUrl } = useImageLoader({ 
            originalUrl: club.banner_url,
            bucket: STORAGE_BUCKETS.CLUB_BANNERS,
            fallbackImageUrl: '/default-banner.svg'
          });

          return (
            <div key={club.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="relative w-full h-48 bg-gray-100 rounded-t-lg overflow-hidden">
                <img
                  src={bannerUrl || '/default-banner.svg'}
                  alt={`${club.name} banner`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {isClubAdmin(club) && (
                  <>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="absolute bottom-4 right-4 bg-white p-2 rounded-full shadow-md hover:bg-gray-100"
                      title="Update banner"
                    >
                      <Camera className="w-5 h-5 text-gray-600" />
                    </button>
                    <input
                      type="file"
                      ref={fileInputRef}
                      className="hidden"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleBannerUpload(club.id, file);
                        }
                      }}
                    />
                  </>
                )}
              </div>

              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h2 className="text-2xl font-bold mb-2">{club.name}</h2>
                    <p className="text-gray-600 mb-4">{club.description}</p>
                    
                    {/* Club Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div className="flex items-center text-gray-600">
                        <Users className="w-5 h-5 mr-2 text-purple-600" />
                        <span>{getClubStats(club.id).follower_count} followers</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Bell className="w-5 h-5 mr-2 text-purple-600" />
                        <span>{getClubStats(club.id).announcement_count} announcements</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Calendar className="w-5 h-5 mr-2 text-purple-600" />
                        <span>{getClubStats(club.id).event_count} events</span>
                      </div>
                      <div className="flex items-center text-gray-600">
                        <Image className="w-5 h-5 mr-2 text-purple-600" />
                        <span>{getClubStats(club.id).post_count} posts</span>
                      </div>
                    </div>
                  </div>

                  {/* Club Actions */}
                  <div className="flex gap-2">
                    {user?.is_admin && (
                      <button
                        onClick={() => handleDeleteClub(club.id)}
                        className="text-red-500 hover:text-red-700"
                        title="Delete Club"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    )}
                    {user && !isClubAdmin(club) && (
                      <button
                        onClick={() => handleFollowToggle(club.id)}
                        className="btn btn-primary btn-sm"
                        disabled={followMutation.isPending}
                      >
                        {followedClubs?.includes(club.id) ? 'Unfollow' : 'Follow'}
                      </button>
                    )}
                    {isClubAdmin(club) && (
                      <button
                        onClick={() => {
                          setSelectedClub(club.id);
                          setShowPostModal(true);
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        Create Post
                      </button>
                    )}
                  </div>
                </div>

                {/* Club Posts */}
                <div className="mt-4">
                  <button
                    onClick={() => setSelectedClub(selectedClub === club.id ? null : club.id)}
                    className="btn btn-secondary btn-sm mb-4"
                  >
                    {selectedClub === club.id ? 'Hide Posts' : 'Show Posts'}
                  </button>

                  {selectedClub === club.id && (
                    <div className="space-y-4">
                      {clubPosts?.map(post => {
                        return (
                          <div key={post.id} className="bg-gray-50 p-4 rounded-lg">
                            <div className="flex justify-between items-start mb-2">
                              <h3 className="text-xl font-semibold">{post.title}</h3>
                              {isPostAdmin(post) && (
                                <button
                                  onClick={() => handleDeletePost(post.id)}
                                  className="text-red-500 hover:text-red-700"
                                  title="Delete Post"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                            <p className="text-gray-600 mb-2">{post.description}</p>
                            {post.image_url && (
                              <div className="mt-4 mb-4">
                                <img
                                  src={useImageLoader({ 
                                    originalUrl: post.image_url,
                                    bucket: STORAGE_BUCKETS.CLUB_POSTS,
                                    fallbackImageUrl: '/default-post.svg'
                                  }).imageUrl || '/default-post.svg'}
                                  alt={post.title}
                                  className="w-full h-auto rounded-lg shadow-md"
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.src = '/default-post.svg';
                                  }}
                                />
                              </div>
                            )}
                            
                            {/* Reactions */}
                            <div className="flex items-center gap-4 mt-4 mb-2">
                              {REACTION_TYPES.map((reaction) => {
                                const Icon = reaction.icon;
                                const postReactions = getPostReactions(post.id);
                                const reactionData = postReactions[reaction.type] || { count: 0, userReacted: false };
                                
                                return (
                                  <button
                                    key={reaction.type}
                                    onClick={() => handleReaction(post.id, reaction.type)}
                                    className={`flex items-center gap-2 px-3 py-2 rounded-full transition-all duration-200 ${
                                      reactionData.userReacted
                                        ? `${reaction.bgColor} ${reaction.activeColor}`
                                        : `hover:bg-gray-100 ${reaction.hoverColor} text-gray-500`
                                    }`}
                                    disabled={!user}
                                    title={user ? `${reaction.type.toLowerCase()} this post` : 'Login to react'}
                                  >
                                    <Icon
                                      className={`w-5 h-5 ${reactionData.userReacted ? 'fill-current' : ''}`}
                                      strokeWidth={reactionData.userReacted ? 2.5 : 2}
                                    />
                                    <span className={`text-sm font-medium ${
                                      reactionData.userReacted ? reaction.activeColor : 'text-gray-600'
                                    }`}>
                                      {reactionData.count > 0 ? reactionData.count : ''}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>

                            <div className="text-sm text-gray-500">
                              Posted on {new Date(post.created_at).toLocaleDateString()}
                            </div>
                          </div>
                        );
                      })}
                      {(!clubPosts || clubPosts.length === 0) && (
                        <p className="text-gray-500">No posts yet.</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showPostModal && selectedClub && (
        <ClubPostModal
          clubId={selectedClub}
          onClose={() => {
            setShowPostModal(false);
            setSelectedClub(null);
          }}
          onSuccess={() => {
            setShowPostModal(false);
            setSelectedClub(null);
            queryClient.invalidateQueries(['club-posts', selectedClub]);
          }}
        />
      )}
    </div>
  );
}