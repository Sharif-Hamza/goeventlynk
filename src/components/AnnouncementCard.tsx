import React from 'react';
import { format } from 'date-fns';
import { Heart, ThumbsUp, Star, PartyPopper, Building } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type { Announcement } from '../types';

interface AnnouncementCardProps {
  announcement: Announcement & { club_name?: string };
}

const REACTIONS = [
  { type: 'like', icon: ThumbsUp, label: 'Like' },
  { type: 'love', icon: Heart, label: 'Love' },
  { type: 'star', icon: Star, label: 'Star' },
  { type: 'celebrate', icon: PartyPopper, label: 'Celebrate' },
];

export default function AnnouncementCard({ announcement }: AnnouncementCardProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Query for reactions
  const { data: reactionData } = useQuery({
    queryKey: ['announcement-reactions', announcement.id],
    queryFn: async () => {
      const { data: reactions, error } = await supabase
        .from('announcement_reactions')
        .select('*')
        .eq('announcement_id', announcement.id);

      if (error) throw error;

      const counts: Record<string, number> = {};
      const userReactions: string[] = [];

      reactions.forEach((reaction) => {
        counts[reaction.reaction_type] = (counts[reaction.reaction_type] || 0) + 1;
        if (reaction.user_id === user?.id) {
          userReactions.push(reaction.reaction_type);
        }
      });

      return { counts, userReactions };
    },
  });

  // Mutation for toggling reactions
  const toggleReaction = useMutation({
    mutationFn: async (reactionType: string) => {
      if (!user) throw new Error('Must be logged in to react');

      const { data: existingReaction } = await supabase
        .from('announcement_reactions')
        .select('*')
        .eq('announcement_id', announcement.id)
        .eq('user_id', user.id)
        .eq('reaction_type', reactionType)
        .single();

      if (existingReaction) {
        const { error } = await supabase
          .from('announcement_reactions')
          .delete()
          .eq('announcement_id', announcement.id)
          .eq('user_id', user.id)
          .eq('reaction_type', reactionType);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('announcement_reactions')
          .insert([
            {
              announcement_id: announcement.id,
              user_id: user.id,
              reaction_type: reactionType,
            },
          ]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['announcement-reactions', announcement.id],
      });
    },
    onError: () => {
      toast.error('Failed to update reaction');
    },
  });

  const handleReactionClick = (reactionType: string) => {
    if (!user) {
      toast.error('Please sign in to react to announcements');
      return;
    }
    toggleReaction.mutate(reactionType);
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">{announcement.title}</h3>
          {announcement.club_name && (
            <div className="flex items-center gap-2 text-sm text-purple-600 mt-1">
              <Building className="w-4 h-4" />
              <span>{announcement.club_name}</span>
            </div>
          )}
        </div>
        <span className="text-sm text-gray-500">
          {format(new Date(announcement.created_at), 'PPP')}
        </span>
      </div>

      {announcement.image_url && (
        <img
          src={announcement.image_url}
          alt={announcement.title}
          className="w-full h-64 object-cover rounded-lg mb-4"
        />
      )}

      <p className="text-gray-600 whitespace-pre-wrap mb-4">{announcement.content}</p>

      <div className="flex flex-wrap gap-2">
        {REACTIONS.map(({ type, icon: Icon, label }) => (
          <button
            key={type}
            onClick={() => handleReactionClick(type)}
            disabled={toggleReaction.isPending}
            className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
              reactionData?.userReactions?.includes(type)
                ? 'bg-purple-100 text-purple-800'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
            title={label}
          >
            <Icon className="w-4 h-4" />
            <span>{reactionData?.counts?.[type] || 0}</span>
          </button>
        ))}
      </div>
    </div>
  );
}