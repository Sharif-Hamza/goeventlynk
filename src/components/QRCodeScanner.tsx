import React, { useEffect, useRef, useState } from 'react';
import { BrowserQRCodeReader, IScannerControls } from '@zxing/browser';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface QRCodeScannerProps {
  onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onClose }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const { user } = useAuth();

  useEffect(() => {
    const initializeScanner = async () => {
      try {
        // First check for camera permission
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        setHasPermission(true);

        // Stop the test stream
        stream.getTracks().forEach(track => track.stop());

        if (!videoRef.current) return;

        const codeReader = new BrowserQRCodeReader();
        
        controlsRef.current = await codeReader.decodeFromVideoDevice(
          undefined, // Let the library choose the best camera
          videoRef.current,
          async (result) => {
            if (!result || !user) return;

            try {
              let ticketId = result.getText();

              // Try to parse JSON if the QR code contains JSON data
              try {
                const parsedData = JSON.parse(ticketId);
                ticketId = parsedData.ticketId || parsedData.id || ticketId;
              } catch (e) {
                // If parsing fails, use the raw text
              }

              // Check user permissions
              const { data: userProfile, error: userError } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

              if (userError || !userProfile) {
                toast.error('Failed to verify user permissions');
                return;
              }

              if (!['admin', 'club_admin'].includes(userProfile.role)) {
                toast.error('You do not have permission to validate tickets');
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
              const { error: updateError } = await supabase
                .from('event_tickets')
                .update({
                  used_at: new Date().toISOString(),
                  validated_by: user.id
                })
                .eq('id', ticketId);

              if (updateError) {
                toast.error('Failed to validate ticket');
                return;
              }

              toast.success('Ticket validated successfully!');
              onClose();
            } catch (error) {
              console.error('Error processing ticket:', error);
              toast.error('Failed to process ticket');
            }
          }
        );
      } catch (error) {
        console.error('Failed to initialize scanner:', error);
        setHasPermission(false);
        toast.error('Failed to access camera. Please check permissions and try again.');
      }
    };

    initializeScanner();

    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop();
      }
    };
  }, [user, onClose]);

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
              <video 
                ref={videoRef}
                className="w-full rounded-lg"
                style={{ 
                  maxHeight: '70vh',
                  backgroundColor: '#000000'
                }}
              />
              <div className="absolute inset-0 border-2 border-blue-500 opacity-50 pointer-events-none">
                <div className="absolute inset-0 border-4 border-blue-500 rounded-lg"></div>
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br"></div>
              </div>
            </div>
          )}
          {hasPermission && (
            <p className="text-sm text-gray-600 mt-4 text-center">
              Position the QR code within the frame to scan
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default QRCodeScanner;
