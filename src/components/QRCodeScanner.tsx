import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { validateTicketData } from '../utils/ticketUtils';
import { X } from 'lucide-react';
import { BrowserMultiFormatReader, BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';

interface QRCodeScannerProps {
  onClose: () => void;
}

const BarcodeScanner: React.FC<QRCodeScannerProps> = ({ onClose }) => {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const [manualInput, setManualInput] = useState<string>('');

  useEffect(() => {
    if (!scanning) return;

    const initializeScanner = async () => {
      try {
        setDebugInfo('Requesting camera permission...');
        
        // First, explicitly request camera permission
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        
        // If we got here, permission was granted
        setDebugInfo(prev => prev + '\nCamera permission granted');

        // Initialize the barcode reader
        const codeReader = new BrowserMultiFormatReader();
        readerRef.current = codeReader;

        // Configure for Code128 format
        codeReader.setHints(new Map([[DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128]]]));

        // Get available video devices
        const videoInputDevices = await codeReader.listVideoInputDevices();
        setDebugInfo(prev => prev + '\nFound cameras: ' + videoInputDevices.map(device => device.label).join(', '));

        // Select the back camera if available, otherwise use the first camera
        const selectedDevice = videoInputDevices.find(device => 
          device.label.toLowerCase().includes('back') || 
          device.label.toLowerCase().includes('environment')
        ) || videoInputDevices[0];

        if (!videoRef.current) {
          throw new Error('Video element not found');
        }

        // Stop the initial stream to avoid conflicts
        stream.getTracks().forEach(track => track.stop());

        // Start the barcode reader with the selected device
        await codeReader.decodeFromConstraints(
          {
            video: {
              deviceId: selectedDevice?.deviceId,
              facingMode: { ideal: 'environment' },
              width: { min: 640, ideal: 1280, max: 1920 },
              height: { min: 480, ideal: 720, max: 1080 },
              aspectRatio: { ideal: 1.7777777778 },
              frameRate: { ideal: 30 }
            }
          },
          videoRef.current,
          async (result, error) => {
            if (result) {
              const scannedData = result.getText();
              setDebugInfo(prev => prev + '\nScanned data: ' + scannedData);
              
              // Stop scanning and process the result
              codeReader.reset();
              setScanning(false);
              await processTicket(scannedData);
            }
            
            // Only log non-NotFound errors (NotFound is expected when no barcode is in view)
            if (error && !(error instanceof NotFoundException)) {
              setDebugInfo(prev => prev + '\nScanner error: ' + error.message);
            }
          }
        );

        setDebugInfo(prev => prev + '\nScanner initialized successfully');
      } catch (error) {
        console.error('Scanner initialization error:', error);
        setDebugInfo(prev => prev + '\nError: ' + error.message);
        
        if (error.name === 'NotAllowedError') {
          setError('Camera permission denied. Please allow camera access and try again.');
        } else if (error.name === 'NotFoundError') {
          setError('No camera found. Please ensure your device has a camera and try again.');
        } else {
          setError('Failed to start camera. Please try again.');
        }

        setScanning(false);
      }
    };

    initializeScanner();

    // Cleanup function
    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
    };
  }, [scanning]);

  const processTicket = async (encryptedData: string) => {
    if (!user) {
      setDebugInfo('No user logged in');
      return;
    }
    
    try {
      setDebugInfo('Processing scanned data: ' + encryptedData);
      
      // Validate and decrypt the ticket data
      const ticketData = validateTicketData(encryptedData);
      setDebugInfo(prev => prev + '\nDecrypted ticket data: ' + JSON.stringify(ticketData));

      if (!ticketData) {
        setDebugInfo(prev => prev + '\nInvalid ticket data');
        toast.error('Invalid ticket data');
        return;
      }

      // Get ticket from database
      const { data: ticket, error: fetchError } = await supabase
        .from('event_tickets')
        .select('*, events(*)')
        .eq('id', ticketData.ticketId)
        .eq('ticket_number', ticketData.ticketNumber)
        .single();

      setDebugInfo(prev => prev + '\nFetch result: ' + JSON.stringify({ ticket, error: fetchError }));

      if (fetchError || !ticket) {
        setDebugInfo(prev => prev + '\nTicket not found');
        toast.error('Ticket not found');
        return;
      }

      // Verify user permissions
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (userError || !userProfile) {
        setDebugInfo(prev => prev + '\nFailed to verify permissions');
        toast.error('Failed to verify user permissions');
        return;
      }

      if (!['admin', 'club_admin'].includes(userProfile.role)) {
        setDebugInfo(prev => prev + '\nInsufficient permissions');
        toast.error('Insufficient permissions to validate tickets');
        return;
      }

      if (ticket.used_at) {
        setDebugInfo(prev => prev + '\nTicket already used');
        toast.error('Ticket has already been used');
        return;
      }

      // Update ticket status
      const { error: updateError } = await supabase
        .from('event_tickets')
        .update({
          used_at: new Date().toISOString(),
          validated_by: user.id,
          status: 'used'
        })
        .eq('id', ticket.id);

      if (updateError) {
        setDebugInfo(prev => prev + '\nValidation failed: ' + updateError.message);
        toast.error('Failed to validate ticket');
        return;
      }

      setDebugInfo(prev => prev + '\nTicket validated successfully!');
      toast.success('Ticket validated successfully!');
      onClose();
    } catch (error) {
      console.error('Error processing ticket:', error);
      setDebugInfo(prev => prev + '\nError: ' + error.message);
      toast.error('Failed to process ticket');
    }
  };

  const verifyTicketByNumber = async (ticketNumber: string) => {
    if (!user) {
      setDebugInfo('No user logged in');
      return;
    }

    try {
      setDebugInfo('Verifying ticket number: ' + ticketNumber);

      // Get ticket by ticket number
      const { data: ticket, error: fetchError } = await supabase
        .from('event_tickets')
        .select('*, events(*)')
        .eq('ticket_number', ticketNumber)
        .single();

      setDebugInfo(prev => prev + '\nFetch result: ' + JSON.stringify({ ticket, error: fetchError }));

      if (fetchError || !ticket) {
        setDebugInfo(prev => prev + '\nTicket not found');
        toast.error('Ticket not found');
        return;
      }

      // Verify user permissions
      const { data: userProfile, error: userError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      setDebugInfo(prev => prev + '\nUser profile: ' + JSON.stringify(userProfile));

      if (userError || !userProfile) {
        setDebugInfo(prev => prev + '\nFailed to verify permissions');
        toast.error('Failed to verify user permissions');
        return;
      }

      if (!['admin', 'club_admin'].includes(userProfile.role)) {
        setDebugInfo(prev => prev + '\nInsufficient permissions');
        toast.error('Insufficient permissions to validate tickets');
        return;
      }

      if (ticket.used_at) {
        setDebugInfo(prev => prev + '\nTicket already used');
        toast.error('Ticket has already been used');
        return;
      }

      // Update ticket status
      const { error: updateError } = await supabase
        .from('event_tickets')
        .update({
          used_at: new Date().toISOString(),
          validated_by: user.id,
          status: 'used'
        })
        .eq('id', ticket.id);

      setDebugInfo(prev => prev + '\nUpdate result: ' + JSON.stringify({ error: updateError }));

      if (updateError) {
        setDebugInfo(prev => prev + '\nValidation failed: ' + updateError.message);
        toast.error('Failed to validate ticket');
        return;
      }

      setDebugInfo(prev => prev + '\nTicket validated successfully!');
      toast.success('Ticket validated successfully!');
      onClose();
    } catch (error) {
      console.error('Error verifying ticket:', error);
      setDebugInfo(prev => prev + '\nError: ' + error.message);
      toast.error('Failed to verify ticket');
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      verifyTicketByNumber(manualInput.trim());
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-lg w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Verify Ticket</h3>
          <button
            onClick={() => {
              if (readerRef.current) {
                readerRef.current.reset();
              }
              setScanning(false);
              onClose();
            }}
            className="text-gray-500 hover:text-gray-700"
          >
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleManualSubmit} className="mb-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Enter ticket number"
              className="flex-1 p-2 border rounded"
            />
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
            >
              Verify
            </button>
          </div>
        </form>

        <div className="text-center text-sm text-gray-500 mb-4">
          - OR -
        </div>

        {error ? (
          <div className="text-red-500 text-center mb-4">
            {error}
            <button
              onClick={() => {
                setError(null);
                setScanning(true);
              }}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 w-full"
            >
              Try Again
            </button>
          </div>
        ) : (
          <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
              autoPlay
              muted
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-full h-24 border-2 border-purple-500 bg-purple-500 bg-opacity-10">
                <div className="w-full h-full border-l-2 border-r-2 border-purple-500 animate-pulse" />
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 p-2 bg-gray-100 rounded text-sm">
          <p>Debug Info:</p>
          <pre className="whitespace-pre-wrap text-xs">{debugInfo}</pre>
        </div>
      </div>
    </div>
  );
};

export default BarcodeScanner;
