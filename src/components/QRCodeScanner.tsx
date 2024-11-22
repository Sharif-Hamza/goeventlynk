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
  const [isMounted, setIsMounted] = useState(true);

  useEffect(() => {
    // Dynamically import jsQR
    const loadJsQR = async () => {
      try {
        const jsQR = (await import('jsqr')).default;
        if (isMounted) {
          jsQRRef.current = jsQR;
          startCamera();
        }
      } catch (err) {
        console.error('Failed to load jsQR:', err);
        setError('Failed to initialize QR scanner');
      }
    };
    
    loadJsQR();
    
    return () => {
      setIsMounted(false);
      stopScanning();
    };
  }, []);

  const startCamera = async () => {
    try {
      setError(null);
      
      // Get all video devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // Try to get the back camera
      const backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear')
      );
      
      // Camera constraints
      const constraints = {
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 },
          ...(backCamera ? { deviceId: { exact: backCamera.deviceId } } : {})
        }
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current && isMounted) {
        videoRef.current.srcObject = stream;
        streamRef.current = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              resolve(true);
            };
          }
        });
        
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
    if (!canvasRef.current || !videoRef.current || !jsQRRef.current || !isMounted) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext('2d', { willReadFrequently: true });

    if (!context) return;

    const scan = () => {
      if (!isMounted) return;

      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Draw the video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Get image data for QR code scanning
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        
        try {
          // Attempt to find QR code in frame
          const code = jsQRRef.current(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });
          
          if (code) {
            console.log('QR Code found:', code.data);
            processTicket(code.data);
            return;
          }
        } catch (err) {
          console.error('Error scanning QR code:', err);
        }
      }
      
      // Continue scanning if still active
      if (scanning && isMounted) {
        animationFrameRef.current = requestAnimationFrame(scan);
      }
    };

    scan();
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

  const processTicket = async (encryptedData: string) => {
    if (!user || !isMounted) return;

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
      if (isMounted) {
        startCamera();
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Scan Ticket QR Code</h3>
          <button
            onClick={() => {
              stopScanning();
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        {error ? (
          <div className="text-red-500 text-center mb-4">
            {error}
            <button
              onClick={() => {
                setError(null);
                startCamera();
              }}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        ) : null}

        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-black">
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full hidden"
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
