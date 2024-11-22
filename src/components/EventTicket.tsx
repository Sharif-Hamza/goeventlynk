import React, { useEffect, useState } from 'react';
import Barcode from 'react-barcode';
import { format } from 'date-fns';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import { Download } from 'lucide-react';

interface EventTicketProps {
  eventName: string;
  eventDate: string;
  eventLocation: string;
  ticket: {
    id: string;
    event_id: string;
    user_id: string;
    ticket_number: string;
    status: string;
    used_at?: string;
  };
}

const EventTicket: React.FC<EventTicketProps> = ({
  eventName,
  eventDate,
  eventLocation,
  ticket
}) => {
  const [barcodeData, setBarcodeData] = useState<string>('');
  const ticketRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const generateBarcodeData = () => {
      const ticketData = {
        ticketId: ticket.id,
        eventId: ticket.event_id,
        userId: ticket.user_id,
        ticketNumber: ticket.ticket_number,
        timestamp: Date.now()
      };
      const encrypted = encryptTicketData(ticketData);
      setBarcodeData(encrypted);
    };

    generateBarcodeData();
  }, [ticket]);

  const downloadTicket = async () => {
    if (!ticketRef.current) return;

    try {
      const canvas = await html2canvas(ticketRef.current);
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
      pdf.save(`${eventName}-ticket.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div
        ref={ticketRef}
        className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200"
      >
        <div className="bg-purple-600 text-white px-6 py-4">
          <h3 className="text-xl font-semibold">{eventName}</h3>
        </div>

        <div className="grid grid-cols-2 gap-4 p-6">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-500">Date & Time</p>
              <p className="font-medium">{format(new Date(eventDate), 'PPp')}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Location</p>
              <p className="font-medium">{eventLocation}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Ticket Number</p>
              <p className="font-medium">{ticket.ticket_number}</p>
            </div>
            
            <div>
              <p className="text-sm text-gray-500">Attendee</p>
              <p className="font-medium">{ticket.user_id}</p>
            </div>

            <div>
              <p className="text-sm text-gray-500">Status</p>
              <span className={`inline-block px-2 py-1 rounded text-sm font-medium ${
                ticket.status === 'used' ? 'bg-red-100 text-red-800' :
                ticket.status === 'valid' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center justify-center p-4 bg-white rounded-lg shadow-md">
            <div className="mb-2 text-lg font-semibold">Ticket #{ticket.ticket_number}</div>
            <Barcode
              value={barcodeData}
              format="CODE128"
              width={2}
              height={100}
              displayValue={false}
              background="#ffffff"
              lineColor="#000000"
              margin={20}
              className="w-full max-w-[300px]"
            />
            <p className="text-sm text-gray-500 text-center mt-2">
              Scan to verify ticket
            </p>
          </div>
        </div>
      </div>

      <button
        onClick={downloadTicket}
        className="mt-4 flex items-center justify-center gap-2 w-full bg-purple-600 text-white py-2 px-4 rounded-lg hover:bg-purple-700 transition-colors"
      >
        <Download size={20} />
        Download Ticket
      </button>
    </div>
  );
};

export default EventTicket;
