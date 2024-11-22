import React, { useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { validateTicketData } from '../utils/ticketUtils';
import { supabase } from '../lib/supabase';
import toast from 'react-hot-toast';

interface QRCodeScannerProps {
  onClose: () => void;
}

const QRCodeScanner: React.FC<QRCodeScannerProps> = ({ onClose }) => {
  const [scanning, setScanning] = useState(true);

  React.useEffect(() => {
    const qrScanner = new Html5Qrcode('qr-reader');
    
    const startScanning = async () => {
      try {
        await qrScanner.start(
          { facingMode: 'environment' },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 }
          },
          handleScan,
          (error) => {
            console.error('QR Scanner error:', error);
          }
        );
      } catch (err) {
        console.error('Failed to start scanner:', err);
        toast.error('Failed to access camera');
      }
    };

    const handleScan = async (decodedText: string) => {
      if (!scanning) return;
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
          .select(`
            id,
            created_at,
            user_id,
            event_id,
            qr_code_data,
            ticket_number,
            status,
            payment_status,
            payment_id,
            check_in_time,
            events:event_id (
              id,
              title,
              date,
              location,
              description,
              image_url,
              club_id,
              clubs:club_id (
                id,
                name,
                image_url
              )
            ),
            profiles:user_id (
              id,
              full_name,
              email
            )
          `)
          .eq('ticket_number', ticketData.ticketNumber)
          .single();

        if (fetchError || !ticket) {
          toast.error('Ticket not found');
          return;
        }

        if (ticket.status !== 'valid') {
          toast.error(`Ticket is ${ticket.status}`);
          return;
        }

        // Update ticket status to used
        const { error: updateError } = await supabase
          .from('event_tickets')
          .update({ 
            status: 'used',
            check_in_time: new Date().toISOString()
          })
          .eq('id', ticket.id);

        if (updateError) {
          toast.error('Failed to update ticket status');
          return;
        }

        toast.success('Ticket verified successfully!');
        
        // Show ticket details
        const ticketDetails = `
          Event: ${ticket.events.title}
          Attendee: ${ticket.profiles.full_name}
          Email: ${ticket.profiles.email}
          Check-in time: ${new Date().toLocaleTimeString()}
        `;
        alert(ticketDetails);
        onClose();
        
      } catch (error) {
        console.error('Error scanning ticket:', error);
        toast.error('Error scanning ticket');
      }
    };

    if (scanning) {
      startScanning();
    }

    return () => {
      try {
        qrScanner.stop();
      } catch (error) {
        console.error('Error stopping scanner:', error);
      }
    };
  }, [onClose, scanning]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white p-4 rounded-lg shadow-lg max-w-md w-full">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-center">Scan Ticket QR Code</h2>
          <p className="text-sm text-gray-500 text-center mt-1">
            Position the QR code within the frame
          </p>
        </div>
        
        <div id="qr-reader" className="w-full overflow-hidden rounded-lg" style={{ minHeight: '300px' }} />

        <button
          onClick={() => {
            setScanning(false);
            onClose();
          }}
          className="mt-4 w-full py-2 px-4 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default QRCodeScanner;
