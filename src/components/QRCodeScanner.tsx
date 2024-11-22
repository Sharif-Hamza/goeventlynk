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
  const [debugInfo, setDebugInfo] = useState<string>('');

  useEffect(() => {
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
      setDebugInfo('Starting camera...');
      
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      setDebugInfo(prev => prev + '\nFound ' + videoDevices.length + ' video devices');
      
      const backCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') || 
        device.label.toLowerCase().includes('rear')
      );
      
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
        
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              setDebugInfo(prev => prev + '\nVideo metadata loaded');
              resolve(true);
            };
          }
        });
        
        await videoRef.current.play();
        setScanning(true);
        setDebugInfo(prev => prev + '\nStarting QR scanning');
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
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // Clear the canvas first
        context.fillStyle = '#000000';
        context.fillRect(0, 0, canvas.width, canvas.height);

        // Draw the video frame
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Enhance contrast
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          const avg = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const threshold = 128;
          const value = avg < threshold ? 0 : 255;
          data[i] = data[i + 1] = data[i + 2] = value;
        }
        context.putImageData(imageData, 0, 0);
        
        try {
          const code = jsQRRef.current(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "attemptBoth",
          });
          
          if (code) {
            setDebugInfo(prev => prev + '\nQR Code found: ' + code.data.substring(0, 20) + '...');
            stopScanning();
            processTicket(code.data);
            return;
          }
        } catch (err) {
          console.error('Error scanning QR code:', err);
          setDebugInfo(prev => prev + '\nError scanning: ' + err.message);
        }
      }
      
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
      setDebugInfo(prev => prev + '\nProcessing ticket...');
      
      const ticketData = validateTicketData(encryptedData);
      if (!ticketData) {
        setDebugInfo(prev => prev + '\nInvalid ticket data');
        toast.error('Invalid ticket data');
        startCamera();
        return;
      }

      setDebugInfo(prev => prev + '\nTicket data validated');

      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError || !userProfile) {
        setDebugInfo(prev => prev + '\nFailed to verify permissions');
        toast.error('Failed to verify user permissions');
        startCamera();
        return;
      }

      if (!['admin', 'club_admin'].includes(userProfile.role)) {
        setDebugInfo(prev => prev + '\nInsufficient permissions');
        toast.error('You do not have permission to validate tickets');
        startCamera();
        return;
      }

      setDebugInfo(prev => prev + '\nFetching ticket details...');
      const { data: ticket, error: fetchError } = await supabase
        .from('event_tickets')
        .select('*, events(*)')
        .eq('id', ticketData.ticketId)
        .single();

      if (fetchError || !ticket) {
        setDebugInfo(prev => prev + '\nTicket not found');
        toast.error('Ticket not found');
        startCamera();
        return;
      }

      if (ticket.user_id !== ticketData.userId || ticket.event_id !== ticketData.eventId) {
        setDebugInfo(prev => prev + '\nTicket data mismatch');
        toast.error('Invalid ticket: Mismatch in ticket data');
        startCamera();
        return;
      }

      if (ticket.used_at) {
        setDebugInfo(prev => prev + '\nTicket already used');
        toast.error('Ticket has already been used');
        startCamera();
        return;
      }

      setDebugInfo(prev => prev + '\nValidating ticket...');
      const { error: updateError } = await supabase
        .from('event_tickets')
        .update({
          used_at: new Date().toISOString(),
          validated_by: user.id
        })
        .eq('id', ticketData.ticketId);

      if (updateError) {
        setDebugInfo(prev => prev + '\nValidation failed');
        toast.error('Failed to validate ticket');
        startCamera();
        return;
      }

      setDebugInfo(prev => prev + '\nTicket validated successfully!');
      toast.success('Ticket validated successfully!');
      onClose();
    } catch (error) {
      console.error('Error processing ticket:', error);
      setDebugInfo(prev => prev + '\nError: ' + error.message);
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

        {import.meta.env.DEV && (
          <div className="mt-4 p-2 bg-gray-100 rounded text-xs font-mono whitespace-pre-wrap">
            {debugInfo}
          </div>
        )}
      </div>
    </div>
  );
};

export default QRCodeScanner;
