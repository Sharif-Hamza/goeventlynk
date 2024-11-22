import React from 'react';
import QRCode from 'qrcode.react';
import { formatDate } from '../utils/dateUtils';

interface EventTicketProps {
  ticket: any;
  showQR?: boolean;
}

const EventTicket: React.FC<EventTicketProps> = ({ ticket, showQR = true }) => {
  const event = ticket.event;
  const isUsed = ticket.status === 'used';

  return (
    <div className="p-4 bg-white rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        {/* Event Details */}
        <div className="flex-1">
          <h3 className="text-xl font-semibold mb-2">{event?.title || 'Event Title'}</h3>
          <p className="text-gray-600 mb-1">
            {event?.event_date ? formatDate(event.event_date) : 'Date TBD'}
          </p>
          <p className="text-gray-600 mb-2">{event?.location || 'Location TBD'}</p>
          <p className="text-sm text-gray-500">Ticket #: {ticket.ticket_number}</p>
          <div className="mt-2">
            <span
              className={`px-2 py-1 text-sm rounded ${
                isUsed
                  ? 'bg-red-100 text-red-800'
                  : 'bg-green-100 text-green-800'
              }`}
            >
              {isUsed ? 'Used' : 'Valid'}
            </span>
          </div>
        </div>

        {/* QR Code */}
        {showQR && ticket.qr_code_data && (
          <div className="flex-shrink-0">
            <QRCode
              value={ticket.qr_code_data}
              size={200}
              level="H"
              includeMargin={true}
              className={isUsed ? 'opacity-50' : ''}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default EventTicket;
