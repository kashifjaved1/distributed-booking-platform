import React, { useState } from 'react';
import { Play, Copy, Check, FileCode, CheckCircle, ChevronRight, Activity } from 'lucide-react';

interface ApiContract {
  service: string;
  method: 'POST' | 'GET' | 'PUT' | 'DELETE';
  endpoint: string;
  desc: string;
  requestModel: string;
  responseModel: string;
}

export default function ApiCatalog() {
  const [activeEndpoint, setActiveEndpoint] = useState<string>('booking-create');
  const [copied, setCopied] = useState<Record<string, boolean>>({});

  const copyCode = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(prev => ({ ...prev, [key]: true }));
    setTimeout(() => {
      setCopied(prev => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const apis: Record<string, ApiContract> = {
    'booking-create': {
      service: 'Booking Service',
      method: 'POST',
      endpoint: '/api/v1/bookings',
      desc: 'Registers a new pending booking request and triggers the orchestrated Saga transaction process.',
      requestModel: `{
  "customerId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "seatNumber": "14F",
  "price": 157.50,
  "idempotencyKey": "idem-bk-88201-92B1"
}`,
      responseModel: `{
  "bookingId": "bk-9910-AA22",
  "sagaId": "saga-85929-F280",
  "status": "ACCEPTED",
  "correlationId": "tx-10928-8820",
  "estimatedProcessingDurationMs": 240
}`
    },
    'booking-get': {
      service: 'Booking Service',
      method: 'GET',
      endpoint: '/api/v1/bookings/{id}',
      desc: 'Retrieves current booking aggregate ledger parameters along with status details.',
      requestModel: '// Parameters: PathParam { id: "bk-9910-AA22" }',
      responseModel: `{
  "id": "bk-9910-AA22",
  "customerId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "seatNumber": "14F",
  "amount": 157.50,
  "status": "CONFIRMED",
  "createdAt": "2026-06-16T13:40:00Z"
}`
    },
    'seat-reserve': {
      service: 'Seat Service',
      method: 'POST',
      endpoint: '/api/v1/seats/reserve',
      desc: 'Executes transactional lock check inside isolated SQL query trees to allocate inventory seats.',
      requestModel: `{
  "bookingId": "bk-9910-AA22",
  "seatNumber": "14F",
  "customerId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}`,
      responseModel: `{
  "reservationId": "res-seat-1029",
  "seatNumber": "14F",
  "status": "RESERVED",
  "concurrencyVersion": 2,
  "timestamp": "2026-06-16T13:40:01Z"
}`
    },
    'seat-release': {
      service: 'Seat Service',
      method: 'POST',
      endpoint: '/api/v1/seats/release',
      desc: 'Unlocks pre-allocated seats during saga compensation (compensation transaction).',
      requestModel: `{
  "bookingId": "bk-9910-AA22",
  "seatNumber": "14F"
}`,
      responseModel: `{
  "seatNumber": "14F",
  "status": "AVAILABLE",
  "releasedAt": "2026-06-16T13:40:05Z"
}`
    },
    'payment-authorize': {
      service: 'Payment Service',
      method: 'POST',
      endpoint: '/api/v1/payments/authorize',
      desc: 'Requests authorization of financial customer balances via external Stripe merchant hooks.',
      requestModel: `{
  "bookingId": "bk-9910-AA22",
  "customerId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "amount": 157.50
}`,
      responseModel: `{
  "transactionId": "pay-txn-4820",
  "status": "AUTHORIZED",
  "gatewayApprovalToken": "ch_stripe_10284A882",
  "authorizedAt": "2026-06-16T13:40:02Z"
}`
    },
    'payment-refund': {
      service: 'Payment Service',
      method: 'POST',
      endpoint: '/api/v1/payments/refund',
      desc: 'Voids approved stripe charges and records refund transactions in DB (compensation transaction).',
      requestModel: `{
  "bookingId": "bk-9910-AA22",
  "amount": 157.50
}`,
      responseModel: `{
  "refundTransactionId": "ref-txn-1290",
  "bookingId": "bk-9910-AA22",
  "refValue": 157.50,
  "status": "REFUNDED"
}`
    },
    'ticket-issue': {
      service: 'Ticket Service',
      method: 'POST',
      endpoint: '/api/v1/tickets/issue',
      desc: 'Generates boarding ticket structures, including cryptographically signed secure barcodes.',
      requestModel: `{
  "bookingId": "bk-9910-AA22",
  "seatNumber": "14F",
  "customerId": "3fa85f64-5717-4562-b3fc-2c963f66afa6"
}`,
      responseModel: `{
  "ticketId": "tkt-0048-BC82",
  "barcodeData": "SHA256_HASH_REPRESENTATION_82910AA821A",
  "status": "ISSUED",
  "issuedAt": "2026-06-16T13:40:03Z"
}`
    },
    'ticket-cancel': {
      service: 'Ticket Service',
      method: 'POST',
      endpoint: '/api/v1/tickets/cancel',
      desc: 'Cancels issued travel tokens and revokes barcode authorizations (compensation transaction).',
      requestModel: `{
  "ticketId": "tkt-0048-BC82"
}`,
      responseModel: `{
  "ticketId": "tkt-0048-BC82",
  "status": "CANCELLED",
  "revokedAt": "2026-06-16T13:40:06Z"
}`
    },
    'notification-send': {
      service: 'Notification Service',
      method: 'POST',
      endpoint: '/api/v1/notifications/send',
      desc: 'Dispatches confirmation emails to SMTP channels. Retries using exponential backoffs on failure.',
      requestModel: `{
  "bookingId": "bk-9910-AA22",
  "toAddress": "user@gmail.com",
  "seatNumber": "14F"
}`,
      responseModel: `{
  "emailLogId": "mail-log-82103",
  "status": "QUEUED_SMTP_DELIVERY"
}`
    }
  };

  const activeApi = apis[activeEndpoint];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="api-catalog-layout">
      {/* Sidebar List */}
      <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4" id="api-sidebar">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">REST API Catalog</h3>
        <div className="space-y-1.5 font-mono" id="api-sidebar-list">
          {Object.entries(apis).map(([key, item]) => {
            let methodBg = 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
            if (item.method === 'GET') methodBg = 'bg-sky-500/10 text-sky-500 border-sky-500/20';

            return (
              <button
                key={key}
                onClick={() => setActiveEndpoint(key)}
                className={`w-full text-left p-3 rounded-lg border text-xs font-semibold flex flex-col gap-1 transition-all ${
                  activeEndpoint === key 
                    ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20' 
                    : 'border-slate-150 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-950'
                }`}
              >
                <div className="flex items-center gap-1.5 select-none">
                  <span className={`text-[9px] px-1.5 py-0.2 rounded border font-bold ${methodBg}`}>{item.method}</span>
                  <span className={`text-[10px] font-bold ${activeEndpoint === key ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-700 dark:text-slate-350'}`}>{item.endpoint}</span>
                </div>
                <span className="block text-[9px] font-sans text-slate-400 font-semibold">{item.service}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* API Details Area */}
      <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between" id="api-content-details">
        <div className="space-y-6">
          <div className="flex justify-between items-start flex-wrap gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{activeApi.service} API Endpoint</span>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${
                    activeApi.method === 'GET' ? 'bg-sky-500/10 text-sky-500 border-sky-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                  }`}
                >
                  {activeApi.method}
                </span>
                <span className="text-sm font-bold font-mono text-slate-800 dark:text-slate-100">{activeApi.endpoint}</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">{activeApi.desc}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="api-models">
            {/* Request Contract */}
            <div className="flex flex-col gap-2" id="request-block">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-slate-600 dark:text-slate-300">Request Model Body (JSON)</span>
                <button 
                  onClick={() => copyCode('req', activeApi.requestModel)}
                  className="p-1 border border-slate-150 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-[10px] text-slate-400 hover:text-indigo-500 px-2 rounded-md transition-all focus:outline-none"
                >
                  {copied['req'] ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="flex-1 bg-slate-950 text-slate-300 p-4 rounded-xl border border-slate-850 font-mono text-xs overflow-x-auto select-all leading-relaxed whitespace-pre-wrap">
                <code>{activeApi.requestModel}</code>
              </pre>
            </div>

            {/* Response Contract */}
            <div className="flex flex-col gap-2" id="response-block">
              <div className="flex justify-between items-center text-xs">
                <div className="flex items-center gap-1.5 font-bold text-slate-600 dark:text-slate-300">
                  <span>Response Payload (JSON)</span>
                  <span className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-1 py-0.2 rounded">Status: 200 OK</span>
                </div>
                <button 
                  onClick={() => copyCode('res', activeApi.responseModel)}
                  className="p-1 border border-slate-150 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50 dark:bg-slate-950 font-mono text-[10px] text-slate-400 hover:text-indigo-500 px-2 rounded-md transition-all focus:outline-none"
                >
                  {copied['res'] ? 'Copied' : 'Copy'}
                </button>
              </div>
              <pre className="flex-1 bg-slate-950 text-slate-300 p-4 rounded-xl border border-slate-850 font-mono text-xs overflow-x-auto select-all leading-relaxed whitespace-pre-wrap">
                <code>{activeApi.responseModel}</code>
              </pre>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2 text-xs text-slate-400 bg-slate-50 dark:bg-slate-950/20 p-3.5 rounded-lg select-none leading-relaxed">
          <Activity className="h-4 w-4 text-indigo-500" />
          <span>Note: Swagger/OpenAPI documentation endpoints are reachable on matching service instances via standard development UI path parameters at <code className="bg-slate-200 dark:bg-slate-800 py-0.5 px-1.5 rounded text-[11px] font-mono text-slate-600 dark:text-slate-300">/swagger</code></span>
        </div>
      </div>
    </div>
  );
}
