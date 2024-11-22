import React, { useState } from 'react';
import QrReader from 'react-qr-reader-es6';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

interface QRCodeScannerProps {
  onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onClose }) => {
  const [scanning, setScanning] = useState(true);
  const { user } = useAuth();

  const handleError = (err: any) => {
    console.error('QR Scanner error:', err);
    toast.error('Failed to access camera. Please check permissions and try again.');
  };

  const handleScan = async (data: string | null) => {
    if (!data || !user || !scanning) return;
    setScanning(false);

    try {
      let ticketId = data;
      
      // Check if the scanned text is a JSON string
      try {
        const parsedData = JSON.parse(data);
        ticketId = parsedData.ticketId || parsedData.id || data;
      } catch (e) {
        // If parsing fails, assume the scanned text is the ticket ID directly
      }

      // Check user permissions
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError || !userProfile) {
        toast.error('Failed to verify user permissions');
        setScanning(true);
        return;
      }

      if (!['admin', 'club_admin'].includes(userProfile.role)) {
        toast.error('You do not have permission to validate tickets');
        setScanning(true);
        return;
      }

      // Fetch ticket details
      const { data: ticket, error: fetchError } = await supabase
        .from('event_tickets')
        .select('*, events(*)')
        .eq('id', ticketId)
        .single();

      if (fetchError || !ticket) {
        toast.error('Ticket not found');
        setScanning(true);
        return;
      }

      // Check club admin permissions
      if (userProfile.role === 'club_admin') {
        const { data: clubAdmin } = await supabase
          .from('club_admins')
          .select('*')
          .eq('user_id', user.id)
          .eq('club_id', ticket.events.club_id)
          .single();

        if (!clubAdmin) {
          toast.error('You do not have permission to validate tickets for this event');
          setScanning(true);
          return;
        }
      }

      if (ticket.used_at) {
        toast.error('Ticket has already been used');
        setScanning(true);
        return;
      }

      // Update ticket
      const { error: updateError } = await supabase
        .from('event_tickets')
        .update({ 
          used_at: new Date().toISOString(),
          validated_by: user.id 
        })
        .eq('id', ticketId);

      if (updateError) {
        toast.error('Failed to validate ticket');
        setScanning(true);
        return;
      }

      toast.success('Ticket validated successfully!');
      onClose();
    } catch (error) {
      console.error('Error handling scan:', error);
      toast.error('Failed to process ticket');
      setScanning(true);
    }
  };

  if (!user) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg p-6">
          <p>Please log in to scan tickets.</p>
          <button
            onClick={onClose}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="p-4 border-b">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Scan QR Code</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div className="p-4">
          <div className="overflow-hidden rounded-lg">
            <QrReader
              delay={300}
              onError={handleError}
              onScan={handleScan}
              style={{ width: '100%' }}
              facingMode="environment"
            />
          </div>
          <p className="text-sm text-gray-600 mt-4 text-center">
            Position the QR code within the frame to scan
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRCodeScanner;
