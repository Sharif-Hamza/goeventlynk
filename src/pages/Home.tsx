import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, Bell, Users, ArrowRight, CheckCircle } from 'lucide-react';

const features = [
  {
    icon: Calendar,
    title: 'Event Management',
    description: 'Easily create, manage, and RSVP to events',
  },
  {
    icon: Bell,
    title: 'Announcements',
    description: 'Stay updated with important event notifications',
  },
  {
    icon: Users,
    title: 'Community',
    description: 'Connect with events that match your interests',
  },
];

const benefits = [
  'Real-time event updates and notifications',
  'Seamless RSVP and ticket purchasing',
  'Direct communication with event administrators',
  'Personalized event recommendations',
];

export default function Home() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Hero Section */}
      <div className="text-center py-20 space-y-8 animate-fade-down">
        <h1 className="text-5xl md:text-6xl font-bold text-gray-900 tracking-tight">
          Welcome to{' '}
          <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-purple-800">
            EventLynk
          </span>
        </h1>
        <p className="text-xl text-gray-600 max-w-3xl mx-auto">
          Your gateway to City College's vibrant event community. Discover events,
          join activities, and stay connected with your fellow students.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            to="/login"
            className="btn btn-primary px-8 py-3 text-lg"
          >
            Get Started
            <ArrowRight className="inline-block ml-2 w-5 h-5" />
          </Link>
        </div>
      </div>

      {/* Features Section */}
      <div className="py-20">
        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="card p-6 text-center animate-fade-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <feature.icon className="w-12 h-12 text-purple-600 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">{feature.title}</h2>
              <p className="text-gray-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Benefits Section */}
      <div className="py-20">
        <div className="bg-gradient-to-br from-purple-600 to-purple-800 rounded-3xl p-8 md:p-12 text-white">
          <h2 className="text-3xl font-bold mb-8 text-center">Why Choose EventLynk?</h2>
          <div className="grid md:grid-cols-2 gap-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 animate-fade-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CheckCircle className="w-6 h-6 flex-shrink-0" />
                <span className="text-lg">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="text-center py-20">
        <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
        <p className="text-xl text-gray-600 mb-8">
          Join the CCNY event community today and never miss an event.
        </p>
        <Link
          to="/login"
          className="btn btn-primary px-8 py-3 text-lg inline-flex items-center"
        >
          Join Now
          <ArrowRight className="ml-2 w-5 h-5" />
        </Link>
      </div>
    </div>
  );
}