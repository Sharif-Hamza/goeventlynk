import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { validateTicketData, decryptTicketData, validateTicket } from '../utils/ticketUtils';
import { X } from 'lucide-react';
import { BrowserMultiFormatReader, BarcodeFormat } from '@zxing/library';

interface QRCodeScannerProps {
  onClose: () => void;
}

export default function QRCodeScanner({ onClose }: QRCodeScannerProps) {
  const { user } = useAuth();
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [manualInput, setManualInput] = useState<string>('');
  const [showManualInput, setShowManualInput] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);

  useEffect(() => {
    const initializeScanner = async () => {
      try {
        readerRef.current = new BrowserMultiFormatReader();
        readerRef.current.formats = [
          BarcodeFormat.QR_CODE,
          BarcodeFormat.CODE_128,
          BarcodeFormat.DATA_MATRIX
        ];
        
        setScanning(true);
        setDebugInfo('Starting scanner...');
        
        if (!videoRef.current) return;
        
        await readerRef.current.decodeFromConstraints(
          {
            audio: false,
            video: {
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
          },
          videoRef.current,
          async (result, err) => {
            if (result) {
              setDebugInfo('Code found: ' + result.getText());
              try {
                await handleTicketValidation(result.getText());
              } catch (error) {
                setDebugInfo('Validation error: ' + error.message);
                toast.error(error.message);
              }
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

  const handleTicketValidation = async (ticketData: string) => {
    if (!user) return;

    try {
      setDebugInfo(`Validating ticket data: ${ticketData}`);
      
      // First try to validate as encrypted data
      let decryptedData = decryptTicketData(ticketData);
      
      if (!decryptedData) {
        // If decryption fails, try validating as a ticket number
        setDebugInfo(prev => `${prev}\nTrying as ticket number...`);
        const { data: ticket, error: fetchError } = await supabase
          .from('event_tickets')
          .select('*')
          .eq('ticket_number', ticketData)
          .single();

        if (fetchError || !ticket) {
          throw new Error('Invalid ticket data or number');
        }

        // Validate ticket using the common validation function
        const result = await validateTicket(ticket.id, user.id);
        if (!result.success) {
          throw new Error(result.message);
        }
      } else {
        // Validate decrypted QR code data
        const { ticketId, eventId, userId, ticketNumber, timestamp } = decryptedData;
        setDebugInfo(prev => `${prev}\nDecrypted ticket ID: ${ticketId}`);

        // Verify ticket exists and matches decrypted data
        const { data: ticketRecord, error: ticketError } = await supabase
          .from('event_tickets')
          .select('*')
          .eq('id', ticketId)
          .eq('event_id', eventId)
          .eq('user_id', userId)
          .eq('ticket_number', ticketNumber)
          .single();

        if (ticketError || !ticketRecord) {
          throw new Error('Ticket not found or invalid');
        }

        // Validate ticket using the common validation function
        const result = await validateTicket(ticketId, user.id);
        if (!result.success) {
          throw new Error(result.message);
        }
      }

      setSuccess('Ticket validated successfully!');
      setError(null);
      toast.success('Ticket validated successfully!');
      onClose();
      
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to validate ticket';
      setError(message);
      setSuccess(null);
      toast.error(message);
      setDebugInfo(prev => `${prev}\nError: ${message}`);
    }
  };

  const verifyTicketByNumber = async (ticketNumber: string) => {
    if (!user) return;

    try {
      setDebugInfo('Verifying ticket number: ' + ticketNumber);

      // Get ticket by ticket number
      const { data: ticket, error: fetchError } = await supabase
        .from('event_tickets')
        .select('*')
        .eq('ticket_number', ticketNumber)
        .single();

      if (fetchError || !ticket) {
        setDebugInfo(prev => prev + '\nTicket not found');
        throw new Error('Ticket not found');
      }

      // Validate ticket using the common validation function
      const result = await validateTicket(ticket.id, user.id);
      
      if (!result.success) {
        throw new Error(result.message);
      }

      setDebugInfo(prev => prev + '\nTicket validated successfully!');
      toast.success('Ticket validated successfully!');
      onClose();

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to validate ticket';
      console.error('Error verifying ticket:', error);
      setDebugInfo(prev => prev + '\nError: ' + message);
      toast.error(message);
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

        {success && (
          <div className="text-green-500 text-center mb-4">
            {success}
          </div>
        )}

        <div className="mt-4 p-2 bg-gray-100 rounded text-sm">
          <p>Debug Info:</p>
          <pre className="whitespace-pre-wrap text-xs">{debugInfo}</pre>
        </div>
      </div>
    </div>
  );
}
