import React, { useState } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { supabase } from '../lib/supabase';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { GraduationCap } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    fullName: '',
  });

  if (user) {
    return <Navigate to={user.is_admin ? '/dashboard' : '/events'} replace />;
  }

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      let authResponse;
      
      if (isSignUp) {
        // Sign up flow
        authResponse = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.fullName,
            },
          },
        });

        if (authResponse.error) throw authResponse.error;

        toast.success('Account created successfully! Please sign in.');
        setIsSignUp(false);
        setFormData({ ...formData, password: '' });
        return;
      } else {
        // Sign in flow
        authResponse = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });

        if (authResponse.error) throw authResponse.error;

        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*, clubs(*)')
          .eq('id', authResponse.data.user.id)
          .single();

        if (profileError) {
          console.warn('Profile not found, redirecting to events:', profileError);
          navigate('/events');
          toast.success('Signed in successfully!');
          return;
        }

        // Navigate based on role
        if (profile.is_admin || profile.role === 'club_admin') {
          navigate('/dashboard');
        } else {
          navigate('/events');
        }
        
        toast.success('Signed in successfully!');
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-6">
            <GraduationCap className="w-12 h-12 text-purple-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome to EventLynk</h1>
          <p className="text-gray-600">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </p>
        </div>

        <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100">
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div>
                <label htmlFor="fullName" className="block text-sm font-medium text-gray-700">
                  Full Name
                </label>
                <input
                  type="text"
                  id="fullName"
                  required={isSignUp}
                  className="input"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                id="email"
                required
                className="input"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                type="password"
                id="password"
                required
                className="input"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary w-full"
              disabled={loading}
            >
              {loading ? 'Please wait...' : (isSignUp ? 'Create Account' : 'Sign in')}
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-purple-600 hover:text-purple-700 text-sm font-medium"
            >
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
          </div>

          <div className="relative mt-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or continue with</span>
            </div>
          </div>

          <div className="mt-6">
            <Auth
              supabaseClient={supabase}
              appearance={{
                theme: ThemeSupa,
                variables: {
                  default: {
                    colors: {
                      brand: '#7E22CE',
                      brandAccent: '#9333EA',
                      brandButtonText: 'white',
                      defaultButtonBackground: 'white',
                      defaultButtonBackgroundHover: '#F3F4F6',
                      defaultButtonBorder: 'lightgray',
                      defaultButtonText: 'gray',
                      dividerBackground: '#E5E7EB',
                      inputBackground: 'white',
                      inputBorder: '#D1D5DB',
                      inputBorderHover: '#9333EA',
                      inputBorderFocus: '#7E22CE',
                      inputText: 'black',
                      inputLabelText: '#4B5563',
                      inputPlaceholder: '#9CA3AF',
                    },
                  },
                },
              }}
              providers={['google']}
              redirectTo={`${window.location.origin}/auth/callback`}
              onlyThirdPartyProviders
            />
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm text-gray-600">
            By signing in, you agree to our{' '}
            <a href="#" className="text-purple-600 hover:text-purple-700">
              Terms of Service
            </a>{' '}
            and{' '}
            <a href="#" className="text-purple-600 hover:text-purple-700">
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}