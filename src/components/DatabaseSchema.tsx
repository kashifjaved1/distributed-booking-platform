import React, { useState } from 'react';
import { Database, Key, Columns, Eye, ChevronRight } from 'lucide-react';

interface SchemaField {
  name: string;
  type: string;
  isPk?: boolean;
  isFk?: boolean;
  desc: string;
  isConcurrencyToken?: boolean;
}

interface DBTable {
  name: string;
  fields: SchemaField[];
  indexes: string[];
}

interface ServiceDB {
  id: string;
  dbName: string;
  desc: string;
  tables: DBTable[];
}

export default function DatabaseSchema() {
  const [activeDb, setActiveDb] = useState<string>('booking');

  const databases: Record<string, ServiceDB> = {
    booking: {
      id: 'booking',
      dbName: 'BookingDB (@PostgreSQL)',
      desc: 'Saves aggregate state context for ticket bookings, tracks orchestrated saga coordinates, and handles microservice transaction states.',
      tables: [
        {
          name: 'Bookings',
          fields: [
            { name: 'Id', type: 'UUID', isPk: true, desc: 'Primary identifier. Unique booking ID.' },
            { name: 'CustomerId', type: 'UUID', desc: 'Identifies purchasing user entity.' },
            { name: 'SeatNumber', type: 'VARCHAR(10)', desc: 'Pre-requisite allocation token representing seats.' },
            { name: 'Amount', type: 'NUMERIC(12,2)', desc: 'Valuation billing charge amount.' },
            { name: 'Status', type: 'VARCHAR(50)', desc: 'State tracking: PENDING, CONFIRMED, FAILED, REJECTED.' },
            { name: 'RowVersion', type: 'XMIN (uint32)', isConcurrencyToken: true, desc: 'PostgreSQL system column xmin used for optimistic concurrency checking.' },
            { name: 'CreatedAt', type: 'TIMESTAMP WITH TIME ZONE', desc: 'Creation baseline timestamp.' }
          ],
          indexes: [
            'PK_Bookings (Clustered on Id)',
            'IX_Bookings_CustomerId (Non-Clustered on CustomerId)',
            'IX_Bookings_Status (Non-Clustered on Status)'
          ]
        },
        {
          name: 'BookingSagaStates',
          fields: [
            { name: 'SagaId', type: 'UUID', isPk: true, desc: 'Orchestrator instance pointer key.' },
            { name: 'BookingId', type: 'UUID', isFk: true, desc: 'Couples target booking record state.' },
            { name: 'CurrentState', type: 'VARCHAR(100)', desc: 'Saga state machine pointers (e.g. SEAT_RESERVING, COMPENSATING_PAYMENT, COMPLETED).' },
            { name: 'SeatReserved', type: 'BOOLEAN', desc: 'Tracks status checkpoint of Seat Service.' },
            { name: 'PaymentAuthorized', type: 'BOOLEAN', desc: 'Checks checkpoint of Payment Service.' },
            { name: 'TicketIssued', type: 'BOOLEAN', desc: 'Identifies ticket service success.' },
            { name: 'EmailSent', type: 'BOOLEAN', desc: 'Identifies customer confirmation status.' },
            { name: 'RetryCount', type: 'INTEGER', desc: 'For retrying flaky steps.' },
            { name: 'CorrelationId', type: 'VARCHAR(100)', desc: 'Traces across all microservices boundaries.' },
            { name: 'LastUpdated', type: 'TIMESTAMP WITH TIME ZONE', desc: 'Tracks state staleness.' }
          ],
          indexes: [
            'PK_BookingSagaStates (Clustered on SagaId)',
            'UX_BookingSagaStates_BookingId (Unique Index on BookingId)',
            'IX_BookingSagaStates_CorrelationId (Non-Clustered index for tracing searches)'
          ]
        },
        {
          name: 'OutboxMessages',
          fields: [
            { name: 'Id', type: 'UUID', isPk: true, desc: 'Ensures absolute message tracking index.' },
            { name: 'AggregateType', type: 'VARCHAR(100)', desc: 'Entity segment taxonomy type (e.g. Booking).' },
            { name: 'AggregateId', type: 'VARCHAR(100)', desc: 'Points to target identifier (e.g., Booking ID).' },
            { name: 'EventType', type: 'VARCHAR(200)', desc: 'Type reference mapping (e.g. BookingStartedEvent).' },
            { name: 'Payload', type: 'JSONB', desc: 'Serialized event parameters to avoid object translation drifts.' },
            { name: 'Status', type: 'VARCHAR(50)', desc: 'Poller search key: PENDING, PUBLISHED, FAILED.' },
            { name: 'CorrelationId', type: 'VARCHAR(100)', desc: 'Distributed tracing index context link.' },
            { name: 'CreatedAt', type: 'TIMESTAMP WITH TIME ZONE', desc: 'When the DB dual-write locked transaction initiated.' },
            { name: 'ProcessedAt', type: 'TIMESTAMP WITH TIME ZONE (NULL)', desc: 'Nullable: When the AMQP broker confirmed publishing ACK.' }
          ],
          indexes: [
            'PK_OutboxMessages (Clustered on Id)',
            'IX_OutboxMessages_Status_CreatedAt (Highly-Performing Index for polling: Fetch status=PENDING, order by CreatedAt)'
          ]
        }
      ]
    },
    seat: {
      id: 'seat',
      dbName: 'SeatDB (@PostgreSQL)',
      desc: 'Controls seat inventory status, manages high-volume simultaneous locking, and maps compensation callbacks.',
      tables: [
        {
          name: 'Seats',
          fields: [
            { name: 'SeatNumber', type: 'VARCHAR(10)', isPk: true, desc: 'Alphabetical grid index key (e.g. 14F).' },
            { name: 'Status', type: 'VARCHAR(50)', desc: 'AVAILABLE, RESERVED, UNDER_MAINTENANCE.' },
            { name: 'Version', type: 'INT', isConcurrencyToken: true, desc: 'Incremental integer lock version for optimistic locking.' },
            { name: 'Price', type: 'NUMERIC(10,2)', desc: 'Cost tiering.' }
          ],
          indexes: [
            'PK_Seats (Clustered on SeatNumber)',
            'IX_Seats_Status (Non-Clustered index for checking seat availability)'
          ]
        },
        {
          name: 'SeatReservations',
          fields: [
            { name: 'Id', type: 'UUID', isPk: true, desc: 'Primary seat reservation ID.' },
            { name: 'SeatNumber', type: 'VARCHAR(10)', isFk: true, desc: 'Assigned target seat.' },
            { name: 'BookingId', type: 'UUID', desc: 'Orchestrating booking pointer.' },
            { name: 'ReservedAt', type: 'TIMESTAMP WITH TIME ZONE', desc: 'Log timestamp constraint.' }
          ],
          indexes: [
            'PK_SeatReservations (Clustered on Id)',
            'IX_SeatReservations_SeatNumber_BookingId (Non-Clustered index on compound columns)'
          ]
        },
        {
          name: 'OutboxMessages',
          fields: [
            { name: 'Id', type: 'UUID', isPk: true, desc: 'Primary identifier.' },
            { name: 'AggregateType', type: 'VARCHAR(100)', desc: 'Seat' },
            { name: 'AggregateId', type: 'VARCHAR(100)', desc: 'SeatNumber' },
            { name: 'EventType', type: 'VARCHAR(200)', desc: 'SeatReservedEvent, SeatReleasedEvent.' },
            { name: 'Payload', type: 'JSONB', desc: 'Message body metadata.' },
            { name: 'Status', type: 'VARCHAR(50)', desc: 'PENDING / PUBLISHED.' },
            { name: 'CorrelationId', type: 'VARCHAR(100)', desc: 'W3C Tracer traceparent header.' },
            { name: 'CreatedAt', type: 'TIMESTAMP WITH TIME ZONE', desc: 'Log timestamp' }
          ],
          indexes: [
            'PK_OutboxMessages (Clustered)',
            'IX_Outbox_Status_Created (Poll tuning index)'
          ]
        }
      ]
    },
    payment: {
      id: 'payment',
      dbName: 'PaymentDB (@PostgreSQL)',
      desc: 'Tracks ledger interactions with external stripe gateways. Strictly stores idempotent merchant references.',
      tables: [
        {
          name: 'PaymentTransactions',
          fields: [
            { name: 'Id', type: 'UUID', isPk: true, desc: 'Payment aggregate identifier index.' },
            { name: 'BookingId', type: 'UUID', desc: 'Identifies associated booking.' },
            { name: 'Amount', type: 'NUMERIC(12,2)', desc: 'Financial transaction value sum.' },
            { name: 'GatewayReference', type: 'VARCHAR(250)', desc: 'External reference code returned by merchant processor (Stripe/Adyen).' },
            { name: 'Status', type: 'VARCHAR(50)', desc: 'AUTHORIZED, CAPTURED, DECLINED, REFUNDED.' },
            { name: 'CreatedAt', type: 'TIMESTAMP WITH TIME ZONE', desc: 'Baseline transactional timestamp.' }
          ],
          indexes: [
            'PK_PaymentTransactions (Clustered on Id)',
            'UX_PaymentTransactions_BookingId (Unique index to prevent double payments per booking)'
          ]
        },
        {
          name: 'OutboxMessages',
          fields: [
            { name: 'Id', type: 'UUID', isPk: true, desc: 'Message tracer key.' },
            { name: 'AggregateType', type: 'VARCHAR(100)', desc: 'Payment' },
            { name: 'AggregateId', type: 'VARCHAR(100)', desc: 'PaymentTransaction ID' },
            { name: 'EventType', type: 'VARCHAR(200)', desc: 'PaymentAuthorizedEvent, PaymentAuthorizationFailedEvent.' },
            { name: 'Payload', type: 'JSONB', desc: 'Serialized body parameters.' },
            { name: 'Status', type: 'VARCHAR(50)', desc: 'PENDING / PUBLISHED' },
            { name: 'CorrelationId', type: 'VARCHAR(100)', desc: 'Propagated span parent.' },
            { name: 'CreatedAt', type: 'TIMESTAMP WITH TIME ZONE', desc: 'Writing audit date.' }
          ],
          indexes: [
            'PK_OutboxMessages',
            'IX_Outbox_Poller'
          ]
        }
      ]
    },
    ticket: {
      id: 'ticket',
      dbName: 'TicketDB (@PostgreSQL)',
      desc: 'Details booking asset tokens, tracks unique PDF boarding barcode indexes, and governs cancel events.',
      tables: [
        {
          name: 'Tickets',
          fields: [
            { name: 'Id', type: 'UUID', isPk: true, desc: 'Unique physical boarding ticket identifier.' },
            { name: 'BookingId', type: 'UUID', desc: 'Booking mapping relationship.' },
            { name: 'SeatNumber', type: 'VARCHAR(10)', desc: 'Flight/room assigned seat index.' },
            { name: 'BoardingBarcode', type: 'VARCHAR(500)', desc: 'Cryptographically signed ticket barcode string.' },
            { name: 'Status', type: 'VARCHAR(50)', desc: 'ACTIVE, REVOKED, VOIDED.' },
            { name: 'CreatedAt', type: 'TIMESTAMP WITH TIME ZONE', desc: 'Generation timestamp.' }
          ],
          indexes: [
            'PK_Tickets (Clustered on Id)',
            'IX_Tickets_BookingId (Non-Clustered key lookup)'
          ]
        },
        {
          name: 'OutboxMessages',
          fields: [
            { name: 'Id', type: 'UUID', isPk: true, desc: 'Identifier.' },
            { name: 'AggregateType', type: 'VARCHAR(150)', desc: 'Ticket' },
            { name: 'AggregateId', type: 'VARCHAR(150)', desc: 'Ticket ID' },
            { name: 'EventType', type: 'VARCHAR(200)', desc: 'TicketIssuedEvent, TicketCancelledEvent.' },
            { name: 'Payload', type: 'JSONB', desc: 'Parameter block.' },
            { name: 'Status', type: 'VARCHAR(50)', desc: 'PENDING / PUBLISHED' },
            { name: 'CorrelationId', type: 'VARCHAR(100)', desc: 'Context traceParent' },
            { name: 'CreatedAt', type: 'TIMESTAMP WITH TIME ZONE', desc: 'Log timestamp' }
          ],
          indexes: [
            'PK_OutboxMessages',
            'IX_Outbox_Poller'
          ]
        }
      ]
    },
    notification: {
      id: 'notification',
      dbName: 'NotificationDB (@PostgreSQL)',
      desc: 'Chronicles customer dispatch registers, holds outgoing transaction failure registers, and tracks retry backoffs.',
      tables: [
        {
          name: 'EmailLogs',
          fields: [
            { name: 'Id', type: 'UUID', isPk: true, desc: 'Audit dispatch index.' },
            { name: 'ToAddress', type: 'VARCHAR(250)', desc: 'Target customer contact pointer email.' },
            { name: 'Subject', type: 'VARCHAR(500)', desc: 'Subject line header.' },
            { name: 'Status', type: 'VARCHAR(50)', desc: 'SENT, DELIVER_FAILED, RETRYING.' },
            { name: 'RetryCount', type: 'INTEGER', desc: 'Sequential count of transient SMTP socket failures.' },
            { name: 'CreatedAt', type: 'TIMESTAMP WITH TIME ZONE', desc: 'Timeline bookmark.' }
          ],
          indexes: [
            'PK_EmailLogs (Clustered on Id)',
            'IX_EmailLogs_ToAddress (Non-Clustered target index)'
          ]
        },
        {
          name: 'OutboxMessages',
          fields: [
            { name: 'Id', type: 'UUID', isPk: true, desc: 'Audit identifier.' },
            { name: 'AggregateType', type: 'VARCHAR(100)', desc: 'Notification' },
            { name: 'AggregateId', type: 'VARCHAR(100)', desc: 'EmailLog ID' },
            { name: 'EventType', type: 'VARCHAR(200)', desc: 'EmailSentEvent' },
            { name: 'Payload', type: 'JSONB', desc: 'Serial packet.' },
            { name: 'Status', type: 'VARCHAR(50)', desc: 'PENDING / PUBLISHED' },
            { name: 'CorrelationId', type: 'VARCHAR(100)', desc: 'W3C context tracer' },
            { name: 'CreatedAt', type: 'TIMESTAMP WITH TIME ZONE', desc: 'Database index date' }
          ],
          indexes: [
            'PK_OutboxMessages',
            'IX_Outbox_Poller'
          ]
        }
      ]
    }
  };

  const selectedDb = databases[activeDb];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6" id="erd-catalog-container">
      {/* DB Menu Selector Sidebar */}
      <div className="lg:col-span-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm space-y-4" id="db-selector-sidebar">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Microservice Datastores</h3>
        <div className="space-y-1.5" id="db-selector-list">
          {[
            { id: 'booking', label: 'BookingDB', desc: 'Saga State & Booking Ledger', color: 'bg-indigo-500' },
            { id: 'seat', label: 'SeatDB', desc: 'Inventory Allocations', color: 'bg-sky-500' },
            { id: 'payment', label: 'PaymentDB', desc: 'Ledger Charge Registers', color: 'bg-emerald-500' },
            { id: 'ticket', label: 'TicketDB', desc: 'Generated Travel Assets', color: 'bg-pink-500' },
            { id: 'notification', label: 'NotificationDB', desc: 'SMTP Dispatch History Logs', color: 'bg-violet-500' },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveDb(item.id)}
              className={`w-full text-left p-3 rounded-lg border text-xs font-semibold flex items-center justify-between transition-all ${
                activeDb === item.id 
                  ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400' 
                  : 'border-slate-150 dark:border-slate-850 hover:bg-slate-50 dark:hover:bg-slate-950 text-slate-600 dark:text-slate-400'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                <div>
                  <span className="block font-bold">{item.label}</span>
                  <span className="block text-[10px] text-slate-400 mt-0.5">{item.desc}</span>
                </div>
              </div>
              <ChevronRight className="h-4 w-4 opacity-50" />
            </button>
          ))}
        </div>
      </div>

      {/* Tables ERD Representation Column */}
      <div className="lg:col-span-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-6" id="db-erd-main">
        <div>
          <h3 className="text-base font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Database className="h-5 w-5 text-indigo-500 animate-pulse" />
            {selectedDb.dbName} Schema Map
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{selectedDb.desc}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="erd-tables-block">
          {selectedDb.tables.map((table) => (
            <div key={table.name} className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/30 dark:bg-slate-950/10 shadow-xs" id={`table-${table.name}`}>
              {/* Header */}
              <div className="border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-slate-50 dark:bg-slate-900 flex justify-between items-center">
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-slate-800 dark:text-slate-100">
                  <Columns className="h-3.5 w-3.5 text-indigo-500" />
                  <span>{table.name}</span>
                </div>
                <span className="text-[9px] bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-bold px-1.5 py-0.5 rounded">
                  Table Schema
                </span>
              </div>

              {/* Fields */}
              <div className="p-3 divide-y divide-slate-100 dark:divide-slate-850" id={`fields-${table.name}`}>
                {table.fields.map((field) => (
                  <div key={field.name} className="py-2.5 flex items-start justify-between gap-4 text-xs font-mono">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1">
                        {field.isPk && <Key className="h-3 w-3 text-yellow-500 shrink-0" title="Primary Key (PK)" />}
                        {field.isFk && <Key className="h-3 w-3 text-blue-400 shrink-0 transform rotate-180" title="Foreign Key (FK)" />}
                        {field.isConcurrencyToken && <Eye className="h-3 w-3 text-red-400 shrink-0" title="Optimistic Concurrency Checking Column" />}
                        <span className={`font-bold ${field.isPk ? 'text-slate-800 dark:text-white' : 'text-slate-650 dark:text-slate-300'}`}>
                          {field.name}
                        </span>
                      </div>
                      <span className="block text-[10px] text-slate-500 dark:text-slate-400 leading-snug font-sans">{field.desc}</span>
                    </div>
                    <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-350 font-bold px-1.5 py-0.5 rounded shrink-0 select-all">
                      {field.type}
                    </span>
                  </div>
                ))}
              </div>

              {/* Indexes */}
              <div className="bg-slate-50 dark:bg-slate-950 px-4 py-3 border-t border-slate-200 dark:border-slate-800">
                <span className="block text-[9px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">Table Indexes</span>
                <div className="space-y-1 font-mono text-[9px]" id={`indexes-${table.name}`}>
                  {table.indexes.map((idx) => (
                    <div key={idx} className="text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                      <ChevronRight className="h-3 w-3 text-slate-350 shrink-0" />
                      <span className="truncate">{idx}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
