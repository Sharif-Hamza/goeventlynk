import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { validateTicketData } from '../utils/ticketUtils';
import { X } from 'lucide-react';

interface QRCodeScannerProps {
  onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onClose }) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number>();
  const jsQRRef = useRef<any>(null);

  useEffect(() => {
    // Dynamically import jsQR
    import('jsqr').then(module => {
      jsQRRef.current = module.default;
    }).catch(err => {
      console.error('Failed to load jsQR:', err);
      setError('Failed to initialize QR scanner');
    });
  }, []);

  const startCamera = async () => {
    try {
      setError(null);
      
      // Try to get the camera with basic constraints first
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        await videoRef.current.play();
        setScanning(true);
        scanQRCode();
      }
    } catch (err) {
      console.error('Camera error:', err);
      setError('Failed to access camera. Please check permissions and try again.');
      toast.error('Camera access failed');
    }
  };

  const scanQRCode = () => {
    if (!canvasRef.current || !videoRef.current || !jsQRRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const scan = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Draw video frame to canvas with proper orientation
        context.save();
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        context.restore();
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        
        // Scan for QR code
        const code = jsQRRef.current(imageData.data, imageData.width, imageData.height);
        
        if (code) {
          // QR code found!
          processTicket(code.data);
          return; // Stop scanning after finding a valid QR code
        }
      }
      
      // Continue scanning
      if (scanning) {
        animationFrameRef.current = requestAnimationFrame(scan);
      }
    };

    animationFrameRef.current = requestAnimationFrame(scan);
  };

  const stopScanning = () => {
    setScanning(false);
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (user) {
      startCamera();
    }
    return () => {
      stopScanning();
    };
  }, [user]);

  const processTicket = async (encryptedData: string) => {
    if (!user) return;

    try {
      console.log('Processing encrypted ticket data:', encryptedData);
      
      // Stop scanning while processing
      stopScanning();
      
      // Validate and decrypt the QR code data
      const ticketData = validateTicketData(encryptedData);
      if (!ticketData) {
        toast.error('Invalid ticket data');
        startCamera(); // Restart scanning
        return;
      }

      // Check user permissions
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError || !userProfile) {
        toast.error('Failed to verify user permissions');
        startCamera();
        return;
      }

      if (!['admin', 'club_admin'].includes(userProfile.role)) {
        toast.error('You do not have permission to validate tickets');
        startCamera();
        return;
      }

      // Fetch ticket details
      const { data: ticket, error: fetchError } = await supabase
        .from('event_tickets')
        .select('*, events(*)')
        .eq('id', ticketData.ticketId)
        .single();

      if (fetchError || !ticket) {
        toast.error('Ticket not found');
        startCamera();
        return;
      }

      // Validate ticket
      if (ticket.user_id !== ticketData.userId || ticket.event_id !== ticketData.eventId) {
        toast.error('Invalid ticket: Mismatch in ticket data');
        startCamera();
        return;
      }

      if (ticket.used_at) {
        toast.error('Ticket has already been used');
        startCamera();
        return;
      }

      // Update ticket
      const { error: updateError } = await supabase
        .from('event_tickets')
        .update({
          used_at: new Date().toISOString(),
          validated_by: user.id
        })
        .eq('id', ticketData.ticketId);

      if (updateError) {
        toast.error('Failed to validate ticket');
        startCamera();
        return;
      }

      toast.success('Ticket validated successfully!');
      onClose();
    } catch (error) {
      console.error('Error processing ticket:', error);
      toast.error('Failed to process ticket');
      startCamera();
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Scan Ticket QR Code</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {error ? (
          <div className="text-red-500 text-center mb-4">
            {error}
          </div>
        ) : null}

        <div className="relative aspect-square w-full overflow-hidden rounded-lg">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover transform scale-x-[-1]"
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ display: 'none' }}
          />
          <div className="absolute inset-0 border-2 border-purple-500 rounded-lg pointer-events-none" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-purple-500 rounded-lg" />
          </div>
        </div>

        <p className="text-sm text-gray-500 text-center mt-4">
          Position the QR code within the frame to scan
        </p>
      </div>
    </div>
  );
};

export default QRCodeScanner;
