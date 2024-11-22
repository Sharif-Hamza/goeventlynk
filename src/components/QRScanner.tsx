import React, { useState } from 'react';
import { QrReader } from 'react-qr-reader';
import { validateTicketData } from '../utils/ticketUtils';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

interface QRScannerProps {
  onClose: () => void;
  onSuccess?: (ticketData: any) => void;
}

const QRScanner: React.FC<QRScannerProps> = ({ onClose, onSuccess }) => {
  const [scanning, setScanning] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const handleScan = async (result: any) => {
    if (!result || !result.text) return;
    
    setScanning(false);
    
    try {
      const ticketData = validateTicketData(result.text);
      
      if (!ticketData) {
        setError('Invalid ticket data');
        return;
      }

      // Check if ticket exists and is valid
      const { data: ticket, error: fetchError } = await supabase
        .from('event_tickets')
        .select('*')
        .eq('id', ticketData.ticketId)
        .eq('user_id', ticketData.userId)
        .eq('event_id', ticketData.eventId)
        .single();

      if (fetchError || !ticket) {
        setError('Ticket not found');
        return;
      }

      if (ticket.status !== 'valid') {
        setError(`Ticket is ${ticket.status}`);
        return;
      }

      // Update ticket status to used
      const { error: updateError } = await supabase
        .from('event_tickets')
        .update({
          status: 'used',
          check_in_time: new Date().toISOString()
        })
        .eq('id', ticketData.ticketId);

      if (updateError) {
        setError('Failed to update ticket status');
        return;
      }

      toast.success('Ticket validated successfully!');
      onSuccess?.(ticket);
      onClose();
    } catch (error) {
      console.error('Error processing ticket:', error);
      setError('Failed to process ticket');
    }
  };

  const handleError = (error: any) => {
    console.error('QR Scanner error:', error);
    setError('Failed to access camera');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 max-w-md w-full mx-4">
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

        {scanning ? (
          <div className="relative aspect-square w-full">
            <QrReader
              constraints={{ facingMode: 'environment' }}
              onResult={handleScan}
              onError={handleError}
              className="w-full h-full"
            />
          </div>
        ) : (
          <div className="text-center py-4">
            <button
              onClick={() => setScanning(true)}
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
            >
              Scan Another Ticket
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRScanner;
