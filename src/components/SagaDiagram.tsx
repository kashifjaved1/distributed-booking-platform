import React, { useState } from 'react';
import { Layers, Shuffle, GitMerge, FileText, ArrowRight, Zap, Info } from 'lucide-react';

export default function SagaDiagram() {
  const [activeTab, setActiveTab] = useState<'statemachine' | 'sequence' | 'outbox'>('statemachine');

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden" id="architecture-diagrams-card">
      <div className="border-b border-slate-200 dark:border-slate-800 px-6 py-4 bg-slate-50/50 dark:bg-slate-900/50">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Shuffle className="h-4 w-4 text-violet-500" />
              Saga & Outbox Architecture Vector Diagrams
            </h3>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Explore interactive distributed state machines, atomic transaction sequences, and reliability conduits.</p>
          </div>
          <div className="flex border border-slate-200 dark:border-slate-800 rounded-lg p-0.5 bg-slate-100 dark:bg-slate-950 text-xs font-semibold">
            {[
              { id: 'statemachine', label: 'Saga State Machine' },
              { id: 'sequence', label: 'Sequence Flow' },
              { id: 'outbox', label: 'Outbox Publisher pipeline' },
            ].map((t) => (
              <button 
                key={t.id} 
                onClick={() => setActiveTab(t.id as any)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  activeTab === t.id 
                    ? 'bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-xs' 
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-6" id="diagrams-viewer-body">
        {activeTab === 'statemachine' && (
          <div className="space-y-6" id="state-machine-canvas">
            <div className="flex items-start gap-4 p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-xs leading-relaxed text-indigo-750 dark:text-indigo-300">
              <Info className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Orchestrated Saga State Transitions</span>
                This orchestrated state machine defines how the Saga coordinator manages transitions. On successful receipt of RabbitMQ messages, state is checkpointed to BookingDB.On failures, compensations run in reverse sequence matching standard distributed ACID constraints.
              </div>
            </div>

            {/* SVG State Machine */}
            <div className="overflow-x-auto py-4 flex justify-center bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-150 dark:border-slate-850">
              <svg viewBox="0 0 850 420" className="w-full max-w-[850px] h-auto font-sans" style={{ minWidth: '780px' }}>
                <defs>
                  <marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#64748b" />
                  </marker>
                  <marker id="arrow-success" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#10b981" />
                  </marker>
                  <marker id="arrow-fail" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 1 L 10 5 L 0 9 z" fill="#f43f5e" />
                  </marker>
                  <filter id="shadow" x="-5%" y="-5%" width="110%" height="110%">
                    <feDropShadow dx="0" dy="2" stdDeviation="3" floodOpacity="0.05" />
                  </filter>
                </defs>

                {/* State Nodes */}
                {/* START Node */}
                <g transform="translate(40, 200)" filter="url(#shadow)">
                  <circle cx="25" cy="25" r="25" fill="#6366f1" />
                  <text x="25" y="29" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle">START</text>
                </g>

                {/* State 1: SEAT_RESERVING */}
                <g transform="translate(140, 165)" filter="url(#shadow)">
                  <rect x="0" y="0" width="110" height="70" rx="8" fill="white" stroke="#6366f1" strokeWidth="2" className="dark:fill-slate-900" />
                  <text x="55" y="25" fill="#1e293b" className="dark:fill-slate-100" fontSize="10" fontWeight="bold" textAnchor="middle">SEAT_RESERVING</text>
                  <text x="55" y="42" fill="#64748b" fontSize="8" textAnchor="middle">Executing reservation</text>
                  <text x="55" y="55" fill="#6366f1" fontSize="8" fontWeight="bold" textAnchor="middle">SeatService</text>
                </g>

                {/* State 2: PAYMENT_AUTHORIZING */}
                <g transform="translate(320, 165)" id="state-node-pay" filter="url(#shadow)">
                  <rect x="0" y="0" width="120" height="70" rx="8" fill="white" stroke="#3b82f6" strokeWidth="1.5" className="dark:fill-slate-900" />
                  <text x="60" y="25" fill="#1e293b" className="dark:fill-slate-100" fontSize="10" fontWeight="bold" textAnchor="middle">PAY_AUTHORIZING</text>
                  <text x="60" y="42" fill="#64748b" fontSize="8" textAnchor="middle">Charging payment...</text>
                  <text x="60" y="55" fill="#3b82f6" fontSize="8" fontWeight="bold" textAnchor="middle">PaymentService</text>
                </g>

                {/* State 3: TICKET_ISSUING */}
                <g transform="translate(510, 165)" filter="url(#shadow)">
                  <rect x="0" y="0" width="115" height="70" rx="8" fill="white" stroke="#ec4899" strokeWidth="1.5" className="dark:fill-slate-900" />
                  <text x="57" y="25" fill="#1e293b" className="dark:fill-slate-100" fontSize="10" fontWeight="bold" textAnchor="middle">TICKET_ISSUING</text>
                  <text x="57" y="42" fill="#64748b" fontSize="8" textAnchor="middle">Issuing pdf asset...</text>
                  <text x="57" y="55" fill="#ec48 pink" fontSize="8" fontWeight="bold" textAnchor="middle">TicketService</text>
                </g>

                {/* State 4: COMPLETED */}
                <g transform="translate(710, 165)" filter="url(#shadow)">
                  <rect x="0" y="0" width="110" height="70" rx="8" fill="#10b981" />
                  <text x="55" y="32" fill="white" fontSize="11" fontWeight="bold" textAnchor="middle">COMPLETED</text>
                  <text x="55" y="48" fill="#ecfdf5" fontSize="8" textAnchor="middle">Booking Confirmed</text>
                  <text x="55" y="58" fill="#10b981" fontSize="6" textAnchor="middle">Success</text>
                </g>

                {/* Compensation: COMPENSATING_PAYMENT */}
                <g transform="translate(480, 290)" filter="url(#shadow)">
                  <rect x="0" y="0" width="130" height="55" rx="8" fill="white" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3 3" className="dark:fill-slate-900" />
                  <text x="65" y="22" fill="#ea580c" fontSize="9" fontWeight="bold" textAnchor="middle">REFUNDING_PAYMENT</text>
                  <text x="65" y="38" fill="#ea580c" fontSize="7.5" textAnchor="middle">COMPENSATION (Void)</text>
                </g>

                {/* Compensation: COMPENSATING_SEAT */}
                <g transform="translate(230, 290)" filter="url(#shadow)">
                  <rect x="0" y="0" width="125" height="55" rx="8" fill="white" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3 3" className="dark:fill-slate-900" />
                  <text x="62.5" y="22" fill="#ea580c" fontSize="9" fontWeight="bold" textAnchor="middle">RELEASING_SEAT</text>
                  <text x="62.5" y="38" fill="#ea580c" fontSize="7.5" textAnchor="middle">COMPENSATION (Unlock)</text>
                </g>

                {/* FAILED State Terminus */}
                <g transform="translate(70, 292)" filter="url(#shadow)">
                  <rect x="0" y="0" width="100" height="50" rx="8" fill="#ef4444" />
                  <text x="50" y="25" fill="white" fontSize="11" fontWeight="bold" textAnchor="middle">FAILED</text>
                  <text x="50" y="40" fill="#fef2f2" fontSize="7.5" textAnchor="middle">Saga Aborted</text>
                </g>

                {/* Connectors & Arrows */}
                {/* START -> SEAT_RESERVING */}
                <path d="M 90 225 L 132 205" fill="none" stroke="#64748b" strokeWidth="1.5" markerEnd="url(#arrow)" />
                
                {/* SEAT_RESERVING -> PAYMENT_AUTHORIZING */}
                <path d="M 250 200 L 312 200" fill="none" stroke="#10b981" strokeWidth="2" markerEnd="url(#arrow-success)" />
                <text x="281" y="192" fill="#10b981" fontSize="8" fontWeight="bold" textAnchor="middle">SeatReserved</text>

                {/* PAYMENT_AUTHORIZING -> TICKET_ISSUING */}
                <path d="M 440 200 L 502 200" fill="none" stroke="#10b981" strokeWidth="2" markerEnd="url(#arrow-success)" />
                <text x="471" y="192" fill="#10b981" fontSize="8" fontWeight="bold" textAnchor="middle">Paid</text>

                {/* TICKET_ISSUING -> COMPLETED */}
                <path d="M 625 200 L 702 200" fill="none" stroke="#10b981" strokeWidth="2" markerEnd="url(#arrow-success)" />
                <text x="6635" y="192" fill="#10b981" fontSize="8" fontWeight="bold" textAnchor="middle">Ticketed</text>

                {/* FAILURE PATHWAYS (Saga Rollbacks) */}
                
                {/* 1. Payment Authorize Fails -> Trigger SEAT Compensation */}
                <path d="M 380 235 L 340 290" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 2" markerEnd="url(#arrow-fail)" />
                <text x="390" y="260" fill="#f43f5e" fontSize="7.5" fontWeight="bold" textAnchor="middle">AuthFailed</text>

                {/* 2. Ticket Issuing Fails -> Trigger PAYMENT Compensation */}
                <path d="M 567 235 L 567 282" fill="none" stroke="#f43f5e" strokeWidth="1.5" strokeDasharray="3 2" markerEnd="url(#arrow-fail)" />
                <text x="608" y="260" fill="#f43f5e" fontSize="7.5" fontWeight="bold" textAnchor="middle">GenerationFailed</text>

                {/* PAYMENT COMPENSATION COMPLETE -> SEAT COMPENSATION */}
                <path d="M 480 317 L 363 317" fill="none" stroke="#ea580c" strokeWidth="1.5" markerEnd="url(#arrow)" />
                <text x="421" y="311" fill="#ea580c" fontSize="7.5" fontWeight="bold" textAnchor="middle">Refunded</text>

                {/* SEAT COMPENSATION COMPLETE -> FAILED TERMINUST */}
                <path d="M 230 317 L 178 317" fill="none" stroke="#ea580c" strokeWidth="1.5" markerEnd="url(#arrow)" />
                <text x="204" y="311" fill="#ea580c" fontSize="7.5" fontWeight="bold" textAnchor="middle">Released</text>
              </svg>
            </div>
          </div>
        )}

        {/* SEQUENCE DIAGRAM */}
        {activeTab === 'sequence' && (
          <div className="space-y-6" id="sequence-diagram-canvas">
            <div className="flex items-start gap-4 p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-xs leading-relaxed text-indigo-750 dark:text-indigo-300">
              <GitMerge className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Distributed Choreography Timeline Ledger</span>
                This AMQP event-propagation timeline diagram shows how messages are routed to decoupled databases. Microservices share absolutely ZERO database resources, relying purely on lightweight transactional events.
              </div>
            </div>

            <div className="overflow-x-auto py-4 flex justify-center bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-150 dark:border-slate-850">
              <svg viewBox="0 0 820 480" className="w-full max-w-[820px] h-auto font-sans" style={{ minWidth: '780px' }}>
                {/* Horizontal Service Swimlanes */}
                <g stroke="#e2e8f0" className="dark:stroke-slate-800" strokeWidth="1" strokeDasharray="3 3">
                  <line x1="80" y1="50" x2="80" y2="440" />
                  <line x1="220" y1="50" x2="220" y2="440" />
                  <line x1="360" y1="50" x2="360" y2="440" />
                  <line x1="500" y1="50" x2="500" y2="440" />
                  <line x1="640" y1="50" x2="640" y2="440" />
                  <line x1="760" y1="50" x2="760" y2="440" />
                </g>

                {/* Service Headers */}
                <g fill="#1e293b" className="dark:fill-slate-200" fontSize="9" fontWeight="bold" textAnchor="middle">
                  {/* User */}
                  <rect x="35" y="15" width="90" height="30" rx="4" fill="#312e81" stroke="#4338ca" strokeWidth="1" />
                  <text x="80" y="33" fill="white">API Client</text>
                  
                  {/* Booking Saga Orchestrator */}
                  <rect x="165" y="15" width="110" height="30" rx="4" fill="#1e1b4b" stroke="#311042" strokeWidth="1" />
                  <text x="220" y="33" fill="white">BookingSaga</text>

                  {/* Seat Service */}
                  <rect x="315" y="15" width="90" height="30" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                  <text x="360" y="33" fill="white">SeatService</text>

                  {/* Payment Service */}
                  <rect x="455" y="15" width="90" height="30" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                  <text x="500" y="33" fill="white">PaymentService</text>

                  {/* Ticket Service */}
                  <rect x="595" y="15" width="90" height="30" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                  <text x="640" y="33" fill="white">TicketService</text>

                  {/* Notification service */}
                  <rect x="715" y="15" width="90" height="30" rx="4" fill="#1e293b" stroke="#334155" strokeWidth="1" />
                  <text x="760" y="33" fill="white">Notification</text>
                </g>

                <defs>
                  <marker id="arrow-seq" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 2 L 8 5 L 0 8 z" fill="#4f46e5" />
                  </marker>
                  <marker id="arrow-reply" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                    <path d="M 0 2 L 8 5 L 0 8 z" fill="#10b981" />
                  </marker>
                </defs>

                {/* Sequence Arrows */}
                {/* 1. Send Booking Request */}
                <path d="M 80 80 L 220 80" fill="none" stroke="#4f46e5" strokeWidth="1.5" markerEnd="url(#arrow-seq)" />
                <text x="150" y="73" fill="#4f46e5" fontSize="8" fontWeight="bold" textAnchor="middle">1. POST /bookings</text>

                {/* 2. DB Atomic updates (Outbox & Saga Init) */}
                <rect x="215" y="90" width="10" height="40" fill="#4f46e5" rx="2" />
                <text x="160" y="112" fill="#64748b" fontSize="7.5" textAnchor="middle" className="italic">Commit BookingDB & Outbox</text>

                {/* 3. Send reserve command */}
                <path d="M 220 145 L 360 145" fill="none" stroke="#4f46e5" strokeWidth="1.5" markerEnd="url(#arrow-seq)" />
                <text x="290" y="138" fill="#4f46e5" fontSize="7.5" fontWeight="bold" textAnchor="middle">2. command: ReserveSeat</text>

                {/* 4. Consume & Reserve Seat */}
                <rect x="355" y="155" width="10" height="30" fill="#0284c7" rx="2" />

                {/* 5. Reply Seat Reserved */}
                <path d="M 360 195 L 220 195" fill="none" stroke="#10b981" strokeWidth="1.5" markerEnd="url(#arrow-reply)" />
                <text x="290" y="188" fill="#10b981" fontSize="7.5" fontWeight="bold" textAnchor="middle">3. event: SeatReserved</text>

                {/* 6. Send Authorize Payment */}
                <path d="M 220 230 L 500 230" fill="none" stroke="#4f46e5" strokeWidth="1.5" markerEnd="url(#arrow-seq)" />
                <text x="360" y="223" fill="#4f46e5" fontSize="7.5" fontWeight="bold" textAnchor="middle">4. command: AuthorizePayment</text>

                {/* 7. DB Charge Payment */}
                <rect x="495" y="240" width="10" height="30" fill="#059669" rx="2" />

                {/* 8. Reply Authorized */}
                <path d="M 500 280 L 220 280" fill="none" stroke="#10b981" strokeWidth="1.5" markerEnd="url(#arrow-reply)" />
                <text x="360" y="273" fill="#10b981" fontSize="7.5" fontWeight="bold" textAnchor="middle">5. event: PaymentAuthorized</text>

                {/* 9. Send Issue Ticket */}
                <path d="M 220 315 L 640 315" fill="none" stroke="#4f46e5" strokeWidth="1.5" markerEnd="url(#arrow-seq)" />
                <text x="430" y="308" fill="#4f46e5" fontSize="7.5" fontWeight="bold" textAnchor="middle">6. command: IssueTicket</text>

                {/* 10. Generate Ticket PDF */}
                <rect x="635" y="325" width="10" height="30" fill="#db2777" rx="2" />

                {/* 11. Reply Ticket Issued */}
                <path d="M 640 365 L 220 365" fill="none" stroke="#10b981" strokeWidth="1.5" markerEnd="url(#arrow-reply)" />
                <text x="430" y="358" fill="#10b981" fontSize="7.5" fontWeight="bold" textAnchor="middle">7. event: TicketIssued</text>

                {/* 12. Complete Booking Saga & Reply to REST user */}
                <path d="M 220 405 L 80 405" fill="none" stroke="#10b981" strokeWidth="1.5" markerEnd="url(#arrow-reply)" />
                <text x="150" y="398" fill="#10b981" fontSize="8" fontWeight="bold" textAnchor="middle">8. COMPLETE Status (Confirmed)</text>

                {/* Parallel send conformation mail */}
                <path d="M 220 425 L 760 425" fill="none" stroke="#4f46e5" strokeWidth="1" strokeDasharray="2 2" markerEnd="url(#arrow-seq)" />
                <text x="490" y="420" fill="#6366f1" fontSize="7" textAnchor="middle">Async Command: SendNotification (Non-blocking)</text>
              </svg>
            </div>
          </div>
        )}

        {/* OUTBOX PIPELINE PATHWAY */}
        {activeTab === 'outbox' && (
          <div className="space-y-6" id="outbox-diagram-canvas">
            <div className="flex items-start gap-4 p-4 bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-lg text-xs leading-relaxed text-indigo-750 dark:text-indigo-300">
              <FileText className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block">Transactional Outbox Dual-Write Architecture</span>
                The Outbox pattern resolves the critical multi-phase network fault dilemma. Microservice locks are combined within an isolated, single relational database database transaction wrapping the aggregate state commit and event queues.
              </div>
            </div>

            <div className="overflow-x-auto py-4 flex justify-center bg-slate-50 dark:bg-slate-950/40 rounded-xl border border-slate-150 dark:border-slate-850">
              <svg viewBox="0 0 840 280" className="w-full max-w-[840px] h-auto font-sans" style={{ minWidth: '780px' }}>
                {/* Microservice Boundary Wrapper */}
                <rect x="15" y="15" width="410" height="250" rx="12" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4 2" />
                <text x="35" y="35" fill="#6366f1" fontSize="9" fontWeight="bold">Microservice Domain Boundary</text>

                {/* API Request */}
                <g transform="translate(45, 90)" filter="url(#shadow)">
                  <rect x="0" y="0" width="85" height="50" rx="6" fill="#312e81" />
                  <text x="42.5" y="24" fill="white" fontSize="9" fontWeight="bold" textAnchor="middle">REST API</text>
                  <text x="42.5" y="38" fill="#c7d2fe" fontSize="8" textAnchor="middle">Command Hook</text>
                </g>

                {/* Database Atomic Box */}
                <g transform="translate(180, 50)">
                  <rect x="0" y="0" width="220" height="180" rx="10" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="1.5" className="dark:fill-slate-900 dark:stroke-slate-800" />
                  <text x="110" y="22" fill="#1e293b" className="dark:fill-slate-100" fontSize="10" fontWeight="bold" textAnchor="middle">PostgreSQL Relational DB</text>
                  
                  {/* Table A: Aggregate */}
                  <rect x="20" y="45" width="180" height="45" rx="4" fill="white" stroke="#38bdf8" className="dark:fill-slate-950" />
                  <text x="35" y="62" fill="#0284c7" fontSize="9" fontWeight="bold">1. Table: EntityAggregate</text>
                  <text x="35" y="77" fill="#64748b" fontSize="7.5">Commit domain entity updates</text>

                  {/* Table B: Outbox Table */}
                  <rect x="20" y="110" width="180" height="45" rx="4" fill="white" stroke="#a855f7" className="dark:fill-slate-950" />
                  <text x="35" y="127" fill="#9333ea" fontSize="9" fontWeight="bold">2. Table: OutboxMessages</text>
                  <text x="35" y="142" fill="#64748b" fontSize="7.5">Insert event serialized payload</text>

                  <text x="110" y="172" fill="#8b5cf6" fontSize="7.5" fontWeight="bold" textAnchor="middle">✓ COMMITTED ATOMICALLY IN DB TX</text>
                </g>

                {/* Connective arrows */}
                <path d="M 130 115 L 172 115" fill="none" stroke="#6366f1" strokeWidth="1.5" markerEnd="url(#arrow-seq)" />

                {/* background Outbox worker */}
                <g transform="translate(490, 100)" filter="url(#shadow)">
                  <rect x="0" y="0" width="140" height="65" rx="8" fill="white" stroke="#a855f7" strokeWidth="2" className="dark:fill-slate-900" />
                  <text x="70" y="22" fill="#1e293b" className="dark:fill-slate-100" fontSize="9.5" fontWeight="bold" textAnchor="middle">OutboxPublisher</text>
                  <text x="70" y="40" fill="#64748b" fontSize="7.5" textAnchor="middle">Background Quartz / Poller</text>
                  <text x="70" y="52" fill="#a855f7" fontSize="7.5" fontWeight="bold" textAnchor="middle">Polls every 250ms</text>
                </g>

                {/* Poll arrow */}
                <path d="M 400 135 L 482 135" fill="none" stroke="#a855f7" strokeWidth="1.5" markerEnd="url(#arrow-seq)" />
                <text x="441" y="127" fill="#9333ea" fontSize="7.5" fontWeight="bold" textAnchor="middle">Fetch Pending</text>

                {/* RabbitMQ box */}
                <g transform="translate(690, 85)" filter="url(#shadow)">
                  <rect x="0" y="0" width="120" height="95" rx="10" fill="#10b981" />
                  <text x="60" y="32" fill="white" fontSize="10" fontWeight="bold" textAnchor="middle">RabbitMQ AMQP</text>
                  <rect x="15" y="48" width="90" height="35" rx="4" fill="#047857" />
                  <text x="60" y="61" fill="white" fontSize="8" fontWeight="bold" textAnchor="middle">booking.exchange</text>
                  <text x="60" y="73" fill="#a7f3d0" fontSize="7.5" textAnchor="middle">Reliable Delivery</text>
                </g>

                {/* Publish Arrow */}
                <path d="M 630 132 L 682 132" fill="none" stroke="#10b981" strokeWidth="2" markerEnd="url(#arrow-reply)" />
                <text x="656" y="123" fill="#10b981" fontSize="7.5" fontWeight="bold" textAnchor="middle">Publish</text>

                {/* Processed Update arrow */}
                <path d="M 560 165 C 560 215, 375 220, 310 160" fill="none" stroke="#64748b" strokeWidth="1.2" strokeDasharray="3 3" markerEnd="url(#arrow-seq)" />
                <text x="450" y="212" fill="#64748b" fontSize="7.5" textAnchor="middle" className="italic">3. Mark processed in Db (Status: PUBLISHED)</text>
              </svg>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
