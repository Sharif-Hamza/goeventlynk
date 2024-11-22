import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { validateTicketData } from '../utils/ticketUtils';

interface QRCodeScannerProps {
  onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onClose }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const { user } = useAuth();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    const initializeScanner = async () => {
      try {
        // Request camera permission first
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach(track => track.stop()); // Stop the stream after permission check
        setHasPermission(true);

        // Initialize QR Scanner
        const qrScanner = new Html5QrcodeScanner(
          "qr-reader",
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true,
            defaultZoomValueIfSupported: 2,
          },
          false
        );

        // Start scanning
        qrScanner.render(
          async (decodedText) => {
            console.log('QR Code detected:', decodedText);
            await processTicket(decodedText);
          },
          (errorMessage) => {
            console.error('QR Scan error:', errorMessage);
          }
        );

        scannerRef.current = qrScanner;
      } catch (error) {
        console.error('Camera permission error:', error);
        setHasPermission(false);
        toast.error('Camera permission denied. Please enable camera access.');
      }
    };

    if (user) {
      initializeScanner();
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, [user]);

  const processTicket = async (encryptedData: string) => {
    if (!user) return;

    try {
      console.log('Processing encrypted ticket data:', encryptedData);
      
      // Validate and decrypt the QR code data
      const ticketData = validateTicketData(encryptedData);
      if (!ticketData) {
        toast.error('Invalid ticket data');
        return;
      }

      console.log('Decrypted ticket data:', ticketData);

      // Check user permissions
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError || !userProfile) {
        toast.error('Failed to verify user permissions');
        console.error('User profile error:', userError);
        return;
      }

      if (!['admin', 'club_admin'].includes(userProfile.role)) {
        toast.error('You do not have permission to validate tickets');
        return;
      }

      // Fetch ticket details using the decrypted ticketId
      console.log('Fetching ticket with ID:', ticketData.ticketId);
      const { data: ticket, error: fetchError } = await supabase
        .from('event_tickets')
        .select('*, events(*)')
        .eq('id', ticketData.ticketId)
        .single();

      if (fetchError || !ticket) {
        console.error('Ticket fetch error:', fetchError);
        toast.error('Ticket not found');
        return;
      }

      console.log('Found ticket:', ticket);

      // Additional validation
      if (ticket.user_id !== ticketData.userId) {
        toast.error('Invalid ticket: User mismatch');
        return;
      }

      if (ticket.event_id !== ticketData.eventId) {
        toast.error('Invalid ticket: Event mismatch');
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
          return;
        }
      }

      if (ticket.used_at) {
        toast.error('Ticket has already been used');
        return;
      }

      // Update ticket
      console.log('Updating ticket status...');
      const { error: updateError } = await supabase
        .from('event_tickets')
        .update({
          used_at: new Date().toISOString(),
          validated_by: user.id
        })
        .eq('id', ticketData.ticketId);

      if (updateError) {
        console.error('Ticket update error:', updateError);
        toast.error('Failed to validate ticket');
        return;
      }

      toast.success('Ticket validated successfully!');
      
      // Stop scanning and close
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
      onClose();
    } catch (error) {
      console.error('Error processing ticket:', error);
      toast.error('Failed to process ticket');
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
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Scan Ticket QR Code</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {hasPermission === false ? (
          <div className="text-center p-4">
            <p className="text-red-600 mb-4">
              Camera access is required to scan QR codes.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Retry Camera Access
            </button>
          </div>
        ) : (
          <div className="relative">
            <div 
              id="qr-reader"
              className="overflow-hidden rounded-lg"
              style={{ 
                width: '100%',
                minHeight: '350px',
                maxHeight: '80vh',
                background: '#000'
              }}
            />
            <style jsx global>{`
              #qr-reader video {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
              }
              #qr-reader__scan_region {
                background: transparent !important;
              }
              #qr-reader__scan_region img {
                display: none !important;
              }
              #qr-reader__dashboard {
                padding: 0 !important;
              }
              #qr-reader__camera_selection {
                width: 100% !important;
                max-width: 400px !important;
                margin: 8px auto !important;
              }
            `}</style>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRCodeScanner;
