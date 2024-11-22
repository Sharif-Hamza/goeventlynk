import React, { useState, useEffect } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { validateTicketData } from '../utils/ticketUtils';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface QRCodeScannerProps {
  onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onClose }) => {
  const [scanning, setScanning] = useState(true);
  const [qrScanner, setQrScanner] = useState<Html5Qrcode | null>(null);

  useEffect(() => {
    const scanner = new Html5Qrcode('qr-reader');
    setQrScanner(scanner);

    return () => {
      if (scanner) {
        scanner.stop().catch(console.error);
      }
    };
  }, []);

  useEffect(() => {
    const startScanning = async () => {
      if (!qrScanner) return;

      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) {
          toast.error('No cameras found');
          return;
        }

        // Try to use the back camera first
        const cameraId = cameras.find(camera => 
          camera.label.toLowerCase().includes('back') || 
          camera.label.toLowerCase().includes('rear')
        )?.id || cameras[0].id;

        await qrScanner.start(
          { deviceId: cameraId },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1,
          },
          handleScan,
          (error) => {
            console.error('QR Scanner error:', error);
          }
        );
      } catch (err) {
        console.error('Failed to start scanner:', err);
        toast.error('Failed to access camera. Please check camera permissions.');
      }
    };

    if (qrScanner && scanning) {
      startScanning();
    }

    return () => {
      if (qrScanner) {
        qrScanner.stop().catch(console.error);
      }
    };
  }, [qrScanner, scanning]);

  const handleScan = async (decodedText: string) => {
    if (!scanning || !qrScanner) return;
    setScanning(false);
    
    try {
      await qrScanner.stop();
      
      const ticketData = validateTicketData(decodedText);
      if (!ticketData) {
        toast.error('Invalid ticket QR code');
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
        return;
      }

      if (ticket.used_at) {
        toast.error('Ticket has already been used');
        return;
      }

      // Update ticket as used
      const { error: updateError } = await supabase
        .from('event_tickets')
        .update({ used_at: new Date().toISOString() })
        .eq('id', ticketData.ticketId);

      if (updateError) {
        toast.error('Failed to validate ticket');
        return;
      }

      toast.success('Ticket validated successfully!');
      onClose();
    } catch (error) {
      console.error('Error handling scan:', error);
      toast.error('Failed to process ticket');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg w-full max-w-md mx-4">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Scan QR Code</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            Close
          </button>
        </div>
        <div 
          id="qr-reader" 
          className="w-full aspect-square bg-gray-100 rounded-lg overflow-hidden"
          style={{ 
            maxWidth: '100%',
            margin: '0 auto',
          }}
        />
        <p className="text-sm text-gray-600 mt-4 text-center">
          Position the QR code within the frame to scan
        </p>
      </div>
    </div>
  );
};

export default QRCodeScanner;
