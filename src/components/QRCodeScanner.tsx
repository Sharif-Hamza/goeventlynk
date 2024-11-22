import React, { useEffect, useRef, useState } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface QRCodeScannerProps {
  onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onClose }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const { user } = useAuth();
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  const processTicket = async (ticketId: string) => {
    if (!user) return;

    try {
      console.log('Processing ticket:', ticketId);
      
      // Try to parse JSON if the QR code contains JSON data
      try {
        const parsedData = JSON.parse(ticketId);
        ticketId = parsedData.ticketId || parsedData.id || ticketId;
      } catch (e) {
        // If parsing fails, use the raw text
        console.log('Using raw text as ticketId:', ticketId);
      }

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

      // Fetch ticket details
      console.log('Fetching ticket with ID:', ticketId);
      const { data: ticket, error: fetchError } = await supabase
        .from('event_tickets')
        .select('*, events(*)')
        .eq('id', ticketId)
        .single();

      if (fetchError || !ticket) {
        console.error('Ticket fetch error:', fetchError);
        toast.error('Ticket not found');
        return;
      }

      console.log('Found ticket:', ticket);

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
        .eq('id', ticketId);

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

  useEffect(() => {
    const initializeScanner = async () => {
      try {
        // Request camera permission
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: "environment"
          } 
        });
        stream.getTracks().forEach(track => track.stop());
        setHasPermission(true);

        // Initialize QR scanner
        scannerRef.current = new Html5QrcodeScanner(
          "reader",
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
            showZoomSliderIfSupported: true,
            defaultZoomValueIfSupported: 2
          },
          false
        );

        scannerRef.current.render(
          async (decodedText) => {
            console.log('QR Code detected:', decodedText);
            await processTicket(decodedText);
          },
          (errorMessage) => {
            // Ignore frequent errors to prevent console spam
            if (errorMessage.includes('NotFoundError')) {
              console.log('No QR code found');
            }
          }
        );
      } catch (error) {
        console.error('Scanner initialization error:', error);
        setHasPermission(false);
        toast.error('Failed to access camera. Please check permissions and try again.');
      }
    };

    initializeScanner();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear();
      }
    };
  }, [user]);

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
              onClick={() => {
                if (scannerRef.current) {
                  scannerRef.current.clear();
                }
                onClose();
              }}
              className="text-gray-500 hover:text-gray-700"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>
        
        <div className="p-4">
          {hasPermission === false ? (
            <div className="text-center p-4">
              <p className="text-red-600 mb-4">Camera access is required to scan tickets.</p>
              <p className="text-sm text-gray-600 mb-4">
                Please enable camera access in your browser settings and try again.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Try Again
              </button>
            </div>
          ) : (
            <div className="relative">
              <div 
                id="reader"
                style={{ 
                  width: '100%',
                  minHeight: '300px'
                }}
              />
            </div>
          )}
          <p className="text-sm text-gray-600 mt-4 text-center">
            Position the QR code within the frame to scan
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRCodeScanner;
