import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Calendar, Settings, HelpCircle, Clock, Menu, X, Building } from 'lucide-react';

export default function Navbar() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const isActive = (path: string) => location.pathname === path;

  const handleSignOut = async () => {
    await signOut();
    navigate('/');
    setIsMenuOpen(false);
  };

  const NavLinks = () => (
    <>
      {user && (
        <>
          <Link 
            to="/events" 
            className={`nav-link ${isActive('/events') ? 'nav-link-active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >
            Events
          </Link>
          <Link 
            to="/announcements" 
            className={`nav-link ${isActive('/announcements') ? 'nav-link-active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >
            Announcements
          </Link>
          <Link 
            to="/clubs" 
            className={`nav-link ${isActive('/clubs') ? 'nav-link-active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >
            Clubs
          </Link>
          
          {/* Show dashboard for both admin and club_admin */}
          {(user.is_admin || user.role === 'club_admin') && (
            <Link 
              to="/dashboard" 
              className={`nav-link ${isActive('/dashboard') ? 'nav-link-active' : ''}`}
              onClick={() => setIsMenuOpen(false)}
            >
              Dashboard
            </Link>
          )}
          <Link 
            to="/event-history" 
            className={`nav-link flex items-center gap-2 ${isActive('/event-history') ? 'nav-link-active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <Clock className="w-5 h-5" />
            <span className="md:hidden">History</span>
          </Link>
          <Link 
            to="/settings" 
            className={`nav-link flex items-center gap-2 ${isActive('/settings') ? 'nav-link-active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <Settings className="w-5 h-5" />
            <span className="md:hidden">Settings</span>
          </Link>
          <Link 
            to="/support" 
            className={`nav-link flex items-center gap-2 ${isActive('/support') ? 'nav-link-active' : ''}`}
            onClick={() => setIsMenuOpen(false)}
          >
            <HelpCircle className="w-5 h-5" />
            <span className="md:hidden">Support</span>
          </Link>
          <button
            onClick={handleSignOut}
            className="btn bg-white text-purple-700 hover:bg-purple-100 w-full md:w-auto"
          >
            Sign Out
          </button>
        </>
      )}
      {!user && (
        <Link
          to="/login"
          className="btn bg-white text-purple-700 hover:bg-purple-100 w-full md:w-auto"
          onClick={() => setIsMenuOpen(false)}
        >
          Sign In
        </Link>
      )}
    </>
  );

  return (
    <nav className="bg-purple-700 text-white shadow-lg sticky top-0 z-50 safe-top">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link to="/" className="flex items-center space-x-2" onClick={() => setIsMenuOpen(false)}>
            <Calendar className="h-8 w-8" />
            <span className="font-bold text-xl">EventLynk</span>
          </Link>

          {/* Mobile menu button */}
          <button
            className="md:hidden p-2 touch-manipulation"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>

          {/* Desktop navigation */}
          <div className="hidden md:flex items-center space-x-4">
            <NavLinks />
          </div>
        </div>

        {/* Mobile navigation */}
        {isMenuOpen && (
          <div className="md:hidden py-4 space-y-2 bg-purple-700">
            <NavLinks />
          </div>
        )}
      </div>
    </nav>
  );
}