import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Html5Qrcode, Html5QrcodeError } from 'html5-qrcode';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';

interface QRCodeScannerProps {
  onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onClose }) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const { user } = useAuth();

  const requestCameraPermission = useCallback(async () => {
    try {
      // First try to get the camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' }
        }
      });

      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      return true;
    } catch (error) {
      console.error('Camera permission error:', error);
      setHasPermission(false);
      return false;
    }
  }, []);

  const initializeScanner = useCallback(async () => {
    if (!scannerRef.current) {
      scannerRef.current = new Html5Qrcode('qr-reader', {
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });
    }

    if (isScanning) {
      return;
    }

    try {
      const devices = await Html5Qrcode.getCameras();
      if (!devices || devices.length === 0) {
        toast.error('No cameras found on your device');
        return;
      }

      // Try to use the back camera first
      const cameraId = devices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear')
      )?.id || devices[0].id;

      await scannerRef.current.start(
        cameraId,
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: window.innerHeight > window.innerWidth ? 1 : 1.777,
        },
        onScanSuccess,
        (errorMessage: string | Html5QrcodeError) => {
          // Only log non-QR code errors
          if (typeof errorMessage === 'string' && !errorMessage.includes('No QR code found')) {
            console.warn(errorMessage);
          }
        }
      );

      setIsScanning(true);
    } catch (err) {
      console.error('Scanner initialization error:', err);
      toast.error('Failed to start camera. Please check permissions and try again.');
      setIsScanning(false);
    }
  }, [isScanning]);

  const onScanSuccess = async (decodedText: string) => {
    if (!scannerRef.current || !user) return;

    try {
      // Pause scanning while processing
      await scannerRef.current.pause(true);

      let ticketId = decodedText;
      
      try {
        const parsedData = JSON.parse(decodedText);
        ticketId = parsedData.ticketId || parsedData.id || decodedText;
      } catch (e) {
        // If parsing fails, use the raw text
      }

      // Verify user permissions
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError || !userProfile) {
        toast.error('Failed to verify user permissions');
        await scannerRef.current.resume();
        return;
      }

      if (!['admin', 'club_admin'].includes(userProfile.role)) {
        toast.error('You do not have permission to validate tickets');
        await scannerRef.current.resume();
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
        await scannerRef.current.resume();
        return;
      }

      // Verify club admin permissions
      if (userProfile.role === 'club_admin') {
        const { data: clubAdmin } = await supabase
          .from('club_admins')
          .select('*')
          .eq('user_id', user.id)
          .eq('club_id', ticket.events.club_id)
          .single();

        if (!clubAdmin) {
          toast.error('You do not have permission to validate tickets for this event');
          await scannerRef.current.resume();
          return;
        }
      }

      if (ticket.used_at) {
        toast.error('Ticket has already been used');
        await scannerRef.current.resume();
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
        await scannerRef.current.resume();
        return;
      }

      toast.success('Ticket validated successfully!');
      onClose();
    } catch (error) {
      console.error('Error handling scan:', error);
      toast.error('Failed to process ticket');
      if (scannerRef.current) {
        await scannerRef.current.resume();
      }
    }
  };

  useEffect(() => {
    const init = async () => {
      const hasPermissions = await requestCameraPermission();
      if (hasPermissions) {
        await initializeScanner();
      }
    };

    init();

    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
        scannerRef.current = null;
      }
      setIsScanning(false);
    };
  }, [initializeScanner, requestCameraPermission]);

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
              <p className="text-sm text-gray-600 mb-4">
                Please enable camera access in your browser settings and try again.
              </p>
              <button
                onClick={() => requestCameraPermission().then(initializeScanner)}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
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
