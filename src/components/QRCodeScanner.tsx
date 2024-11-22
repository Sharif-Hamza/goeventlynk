import React, { useState, useEffect, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeScanner } from 'html5-qrcode';
import { validateTicketData } from '../utils/ticketUtils';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface QRCodeScannerProps {
  onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onClose }) => {
  const [scanner, setScanner] = useState<Html5QrcodeScanner | null>(null);

  const onScanSuccess = useCallback(async (decodedText: string) => {
    if (!scanner) return;
    
    try {
      // Stop scanning immediately after successful scan
      await scanner.pause();
      
      const ticketData = validateTicketData(decodedText);
      if (!ticketData) {
        toast.error('Invalid ticket QR code');
        scanner.resume();
        return;
      }

      // Fetch ticket from database
      const { data: ticket, error: fetchError } = await supabase
        .from('event_tickets')
        .select('*')
        .eq('id', ticketData.ticketId)
        .single();

      if (fetchError || !ticket) {
        toast.error('Ticket not found');
        scanner.resume();
        return;
      }

      if (ticket.used_at) {
        toast.error('Ticket has already been used');
        scanner.resume();
        return;
      }

      // Update ticket as used
      const { error: updateError } = await supabase
        .from('event_tickets')
        .update({ used_at: new Date().toISOString() })
        .eq('id', ticketData.ticketId);

      if (updateError) {
        toast.error('Failed to validate ticket');
        scanner.resume();
        return;
      }

      toast.success('Ticket validated successfully!');
      scanner.clear();
      onClose();
    } catch (error) {
      console.error('Error handling scan:', error);
      toast.error('Failed to process ticket');
      scanner.resume();
    }
  }, [scanner, onClose]);

  const onScanFailure = useCallback((error: any) => {
    // Only log specific errors, not the common "No QR code found" error
    if (error?.message?.includes('No QR code found')) {
      return;
    }
    console.warn('QR Scan error:', error);
  }, []);

  useEffect(() => {
    // Configuration for the scanner
    const config = {
      fps: 10,
      qrbox: {
        width: 250,
        height: 250
      },
      aspectRatio: 1.0,
      showTorchButtonIfSupported: true,
      showZoomSliderIfSupported: true,
      defaultZoomValueIfSupported: 2,
    };

    // Create scanner instance
    const qrScanner = new Html5QrcodeScanner(
      "qr-reader",
      config,
      /* verbose= */ false
    );

    // Start scanning
    qrScanner.render(onScanSuccess, onScanFailure);
    setScanner(qrScanner);

    // Cleanup function
    return () => {
      if (qrScanner) {
        qrScanner.clear().catch(console.error);
      }
    };
  }, [onScanSuccess, onScanFailure]);

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
          <div 
            id="qr-reader" 
            className="overflow-hidden rounded-lg"
            style={{
              width: '100%',
              minHeight: '300px'
            }}
          />
          <p className="text-sm text-gray-600 mt-4 text-center">
            Position the QR code within the frame to scan
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRCodeScanner;
