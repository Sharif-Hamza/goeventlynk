import React from 'react';
import { HelpCircle, Mail, Phone } from 'lucide-react';

export default function Support() {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <HelpCircle className="w-8 h-8 text-purple-700" />
        <h1 className="text-3xl font-bold text-purple-700">Support</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-purple-600" />
              <a href="mailto:support@ccnyclubhub.com" className="text-purple-600 hover:text-purple-700">
                support@ccnyclubhub.com
              </a>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-purple-600" />
              <a href="tel:+1234567890" className="text-purple-600 hover:text-purple-700">
                (000)-000-0000
              </a>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">FAQ</h2>
          <div className="space-y-4">
            <div>
              <h3 className="font-medium text-gray-900">How do I join a club?</h3>
              <p className="text-gray-600 mt-1">Browse through the clubs and click on the "Join" button to become a member.</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">How can I create an event?</h3>
              <p className="text-gray-600 mt-1">Only club admins can create events. If you're an admin, visit your dashboard to create events.</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">How do I RSVP for an event?</h3>
              <p className="text-gray-600 mt-1">Click the RSVP button on any event page to confirm your attendance.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}