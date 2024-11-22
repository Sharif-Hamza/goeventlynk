import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { validateTicketData } from '../utils/ticketUtils';
import { X } from 'lucide-react';
import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/library';

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
    const initializeScanner = async () => {
      try {
        readerRef.current = new BrowserMultiFormatReader();
        readerRef.current.formats = [BarcodeFormat.CODE_128];
        
        setScanning(true);
        setDebugInfo('Starting scanner...');
        
        if (!videoRef.current) return;
        
        await readerRef.current.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
              aspectRatio: { ideal: 1.7777777778 }
            }
          },
          videoRef.current,
          (result, err) => {
            if (result) {
              setDebugInfo('Barcode found: ' + result.getText());
              processTicket(result.getText());
            }
            if (err && scanning) {
              if (Math.random() < 0.1) {
                setDebugInfo(prev => prev + '\nScanning...');
              }
            }
          }
        );
      } catch (error) {
        console.error('Error starting scanner:', error);
        setDebugInfo('Error starting scanner: ' + error.message);
        setError('Error starting scanner');
      }
    };

    initializeScanner();

    return () => {
      if (readerRef.current) {
        readerRef.current.reset();
      }
      setScanning(false);
    };
  }, []);

  const verifyTicketByNumber = async (ticketNumber: string) => {
    if (!user) return;

    try {
      setDebugInfo('Verifying ticket number: ' + ticketNumber);

      // Get ticket by ticket number
      const { data: ticket, error: fetchError } = await supabase
        .from('event_tickets')
        .select('*, events(*)')
        .eq('ticket_number', ticketNumber)
        .single();

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
        setDebugInfo(prev => prev + '\nValidation failed');
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

  const processTicket = async (scannedData: string) => {
    if (!user) return;
    
    try {
      setDebugInfo('Processing scanned data: ' + scannedData);
      
      // Try to verify the scanned data as a ticket number directly
      await verifyTicketByNumber(scannedData);
      
    } catch (error) {
      console.error('Error processing ticket:', error);
      setDebugInfo(prev => prev + '\nError: ' + error.message);
      toast.error('Failed to process ticket');
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
              }}
              className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Retry
            </button>
          </div>
        ) : (
          <div className="relative aspect-video w-full bg-black rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              className="absolute inset-0 w-full h-full object-cover"
              playsInline
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
