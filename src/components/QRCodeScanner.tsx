import React, { useState, useEffect, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { validateTicketData } from '../utils/ticketUtils';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

interface QRCodeScannerProps {
  onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onClose }) => {
  const [scanner, setScanner] = useState<Html5Qrcode | null>(null);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const { user } = useAuth();

  const requestCameraPermission = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: { ideal: 'environment' } 
        } 
      });
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      return true;
    } catch (error) {
      console.error('Camera permission error:', error);
      setHasPermission(false);
      return false;
    }
  }, []);

  const onScanSuccess = useCallback(async (decodedText: string) => {
    if (!scanner || !user) return;
    
    try {
      // Stop scanning immediately after successful scan
      await scanner.stop();

      let ticketId = decodedText;
      
      // Check if the scanned text is a JSON string (from QR code)
      try {
        const parsedData = JSON.parse(decodedText);
        ticketId = parsedData.ticketId || parsedData.id || decodedText;
      } catch (e) {
        // If parsing fails, assume the scanned text is the ticket ID directly
      }

      // First check if the user has permission to validate tickets
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError || !userProfile) {
        toast.error('Failed to verify user permissions');
        await scanner.start();
        return;
      }

      if (!['admin', 'club_admin'].includes(userProfile.role)) {
        toast.error('You do not have permission to validate tickets');
        await scanner.start();
        return;
      }

      // Fetch ticket from database with event details
      const { data: ticket, error: fetchError } = await supabase
        .from('event_tickets')
        .select('*, events(*)')
        .eq('id', ticketId)
        .single();

      if (fetchError || !ticket) {
        toast.error('Ticket not found');
        await scanner.start();
        return;
      }

      // For club_admin, verify they have permission for this event
      if (userProfile.role === 'club_admin') {
        const { data: clubAdmin } = await supabase
          .from('club_admins')
          .select('*')
          .eq('user_id', user.id)
          .eq('club_id', ticket.events.club_id)
          .single();

        if (!clubAdmin) {
          toast.error('You do not have permission to validate tickets for this event');
          await scanner.start();
          return;
        }
      }

      if (ticket.used_at) {
        toast.error('Ticket has already been used');
        await scanner.start();
        return;
      }

      // Update ticket as used
      const { error: updateError } = await supabase
        .from('event_tickets')
        .update({ 
          used_at: new Date().toISOString(),
          validated_by: user.id 
        })
        .eq('id', ticketId);

      if (updateError) {
        toast.error('Failed to validate ticket');
        await scanner.start();
        return;
      }

      toast.success('Ticket validated successfully!');
      onClose();
    } catch (error) {
      console.error('Error handling scan:', error);
      toast.error('Failed to process ticket');
      await scanner.start();
    }
  }, [scanner, onClose, user]);

  useEffect(() => {
    const initializeScanner = async () => {
      const hasPermissions = await requestCameraPermission();
      if (!hasPermissions) {
        toast.error('Camera permission is required to scan tickets');
        return;
      }

      const html5QrCode = new Html5Qrcode("qr-reader");
      
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
          toast.error('No cameras found on your device');
          return;
        }

        // Try to use the back camera first
        const camera = cameras.find(cam => 
          cam.label.toLowerCase().includes('back') || 
          cam.label.toLowerCase().includes('rear')
        ) || cameras[0];

        await html5QrCode.start(
          camera.id,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0
          },
          onScanSuccess,
          (errorMessage) => {
            // Ignore "No QR code found" messages
            if (!errorMessage.includes('No QR code found')) {
              console.warn(errorMessage);
            }
          }
        );

        setScanner(html5QrCode);
      } catch (err) {
        console.error('Error starting scanner:', err);
        toast.error('Failed to start camera. Please check permissions and try again.');
      }
    };

    initializeScanner();

    return () => {
      if (scanner) {
        scanner.stop().catch(console.error);
      }
    };
  }, [onScanSuccess, requestCameraPermission]);

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
          {hasPermission === false && (
            <div className="text-center p-4">
              <p className="text-red-600 mb-4">Camera access is required to scan tickets.</p>
              <p className="text-sm text-gray-600">
                Please enable camera access in your browser settings and try again.
              </p>
              <button
                onClick={() => requestCameraPermission()}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Request Camera Access
              </button>
            </div>
          )}
          <div 
            id="qr-reader" 
            className="overflow-hidden rounded-lg"
            style={{
              width: '100%',
              minHeight: '300px',
              display: hasPermission === false ? 'none' : 'block'
            }}
          />
          {hasPermission !== false && (
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
