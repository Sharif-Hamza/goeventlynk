import React, { useRef } from 'react';
import Barcode from 'react-barcode';

interface EventTicketProps {
  ticket: {
    id: string;
    event_id: string;
    user_id: string;
    ticket_number: string;
    status: string;
    used_at?: string;
    qr_code_data?: string;
    event: {
      id: string;
      title: string;
      event_date: string;
      location: string;
      description: string;
      image_url: string;
    };
  };
}

const EventTicket: React.FC<EventTicketProps> = ({ ticket }) => {
  const ticketRef = useRef<HTMLDivElement>(null);

  return (
    <div className="p-4 bg-white rounded-lg shadow-md max-w-md mx-auto" ref={ticketRef}>
      <div className="space-y-4">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-800">{ticket.event.title}</h2>
          <p className="text-gray-600">{ticket.event.event_date}</p>
          <p className="text-gray-600">{ticket.event.location}</p>
        </div>

        <div className="border-t border-b border-gray-200 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-gray-500 text-sm">Ticket Status</span>
              <span className={`block font-semibold ${
                ticket.status === 'used' ? 'text-red-600' : 'text-green-600'
              }`}>
                {ticket.status.toUpperCase()}
              </span>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Ticket Number</span>
              <span className="block font-semibold text-gray-800">
                {ticket.ticket_number}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-center p-6 bg-white rounded-lg shadow-md">
          <div className="mb-4 text-lg font-semibold">Scan Ticket</div>
          {ticket.qr_code_data && (
            <div className="w-full flex justify-center">
              <Barcode
                value={ticket.qr_code_data}
                format="CODE128"
                width={2}
                height={200}
                displayValue={false}
                background="#ffffff"
                lineColor="#000000"
                margin={10}
              />
            </div>
          )}
          <p className="text-sm text-gray-500 text-center mt-4">
            {ticket.status === 'used' 
              ? 'This ticket has been used' 
              : 'Present this barcode at the event for validation'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default EventTicket;
