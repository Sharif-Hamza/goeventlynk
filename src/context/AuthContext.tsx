import React, { createContext, useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import type { User, Club } from '../types';

interface AuthContextType {
  user: User | null;
  userClub: Club | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [userClub, setUserClub] = useState<Club | null>(null);

  // Use React Query for session management
  const { data: session, isLoading: sessionLoading } = useQuery({
    queryKey: ['auth-session'],
    queryFn: async () => {
      const { data } = await supabase.auth.getSession();
      return data.session;
    },
  });

  // Fetch user profile and club when session changes
  const { isLoading: profileLoading } = useQuery({
    queryKey: ['user-profile', session?.user?.id],
    queryFn: async () => {
      if (!session?.user?.id) return null;

      try {
        // First attempt to fetch the profile
        const { data: existingProfile, error: fetchError } = await supabase
          .from('profiles')
          .select('*, clubs(*)')
          .eq('id', session.user.id)
          .maybeSingle();

        // If profile exists, return it
        if (existingProfile) {
          setUser(existingProfile);
          if (existingProfile.club_id) {
            setUserClub(existingProfile.clubs);
          }
          return existingProfile;
        }

        // If no profile exists and there was no error, create one
        if (!existingProfile && !fetchError) {
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: session.user.id,
              email: session.user.email,
              full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || '',
              avatar_url: session.user.user_metadata?.avatar_url || null,
              role: 'user',
              is_admin: false,
              updated_at: new Date().toISOString(),
            })
            .select('*, clubs(*)')
            .single();

          if (insertError) {
            console.error('Error creating profile:', insertError);
            toast.error('Failed to create profile. Please try again.');
            return null;
          }

          if (newProfile) {
            setUser(newProfile);
            if (newProfile.club_id) {
              setUserClub(newProfile.clubs);
            }
            return newProfile;
          }
        }

        // If we get here, something went wrong
        console.error('Error in profile flow:', fetchError);
        toast.error('Error loading profile. Please refresh the page.');
        return null;

      } catch (err: any) {
        console.error('Error in profile management:', err);
        toast.error('An unexpected error occurred. Please try again.');
        return null;
      }
    },
    enabled: !!session?.user?.id,
    retry: 1, // Only retry once to avoid infinite loops
    retryDelay: 1000, // Wait 1 second before retrying
  });

  const loading = sessionLoading || profileLoading;

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setUserClub(null);
    navigate('/');
  };

  return (
    <AuthContext.Provider value={{ user, userClub, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}