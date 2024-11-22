import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!session?.user) throw new Error('No user in session');

        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*, clubs(*)')
          .eq('id', session.user.id)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
          toast.error('Error fetching profile');
          navigate('/');
          return;
        }

        // Navigate based on role
        if (profile.is_admin || profile.role === 'club_admin') {
          navigate('/dashboard');
        } else {
          navigate('/events');
        }

        toast.success('Signed in successfully!');
      } catch (error: any) {
        console.error('Error in auth callback:', error);
        toast.error(error.message || 'Authentication failed');
        navigate('/');
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-center">
        <h2 className="text-2xl font-semibold text-gray-700 mb-2">Signing you in...</h2>
        <p className="text-gray-500">Please wait while we complete the authentication process.</p>
      </div>
    </div>
  );
}