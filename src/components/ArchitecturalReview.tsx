import React from 'react';
import { ShieldCheck, GitBranch, ArrowUpRight, Scale, CheckSquare, Zap, AlertTriangle, Layers } from 'lucide-react';

export default function ArchitecturalReview() {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm space-y-8" id="design-justifications-memo">
      {/* Executive Summary Pitch */}
      <div>
        <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
          <ShieldCheck className="h-5.5 w-5.5 text-indigo-500" />
          Production readiness & Architectural tradeoffs review
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 pb-4 border-b border-slate-150 dark:border-slate-800 leading-relaxed">
          Compiled by <strong>Principal Platform Architect</strong> &amp; <strong>Staff Distributed Systems Engineer</strong> 
          to justify pattern selection, failure recovery strategies, and eventual consistency boundaries.
        </p>
      </div>

      {/* Grid containing analysis sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8" id="memo-grid">
        {/* Section 1: 2PC vs Saga */}
        <div className="space-y-3" id="memo-2pc-vs-saga">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-650 dark:text-indigo-400 flex items-center gap-1.5 leading-none">
            <Scale className="h-4 w-4" />
            1. Why Distributed Transactions Are Stiff: Outlawing 2PC
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Standard relative transactional writes (ACID) operate smoothly within single database configurations. However, scaling horizontally invites the 
            <strong> Distributed Two-Phase Commit (2PC)</strong> roadblock. 2PC creates massive latency penalties because the coordinator blocks database 
            resources in phase-1 (Prepare) until all voting service branches lock and return voting tokens. 
            This causes severe queuing congestion under latency spikes or network drops, making the entire platform vulnerable to single-point failures.
          </p>
          <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 rounded-lg text-[11px] leading-relaxed">
            <strong>The 2PC Problem:</strong> System-wide availability equals the product of individual service availabilities 
            (A<sub>SYS</sub> = A<sub>1</sub> × A<sub>2</sub> × A<sub>3</sub>). If 2PC coordinates 5 microservices of 99.9% availability, system availability drops to 99.5%, heavily amplifying locking overheads.
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            The <strong>Orchestrated Saga Pattern</strong> eliminates locking blockers by converting the global commit into a set of 
            independent local database transactions. Services write state to local tables, release database locks immediately, 
            and propagate state reports via RabbitMQ message pipelines.
          </p>
        </div>

        {/* Section 2: Outbox Pattern */}
        <div className="space-y-3" id="memo-outbox-importance">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-655 dark:text-indigo-400 flex items-center gap-1.5 leading-none">
            <Zap className="h-4 w-4" />
            2. Dual-Write Fault Prevention via Transactional Outbox
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            A major reliability issue in microservices is the <strong>"Dual-Write Challenge"</strong>. This happens when a service commits state to its database and attempts to publish an event to RabbitMQ in the same action:
          </p>
          <ul className="text-xs text-slate-550 list-disc list-inside pl-1 space-y-1">
            <li>If database atomic save completes first, but RabbitMQ crashes before the publish, downstream services remain unsynchronized.</li>
            <li>If the event publishes to RabbitMQ first, but PostgreSQL rollback hits the database, the exchange carries phantom messages.</li>
          </ul>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            <strong>Our Solution:</strong> The <strong>Transactional Outbox Pattern</strong> groups aggregate state updates and outbound event logging 
            within a single unit-of-work transactions. The event payload is saved to an 
            <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded text-[10.5px] font-mono">OutboxMessages</code> table. 
            An independent background publisher pulls pending events from the table, publishes them to RabbitMQ, 
            and marks them as processed upon confirmation.
          </p>
        </div>

        {/* Section 3: Eventual Consistency */}
        <div className="space-y-3" id="memo-consistency-boundaries">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-655 dark:text-indigo-400 flex items-center gap-1.5 leading-none">
            <GitBranch className="h-4 w-4" />
            3. Eventual Consistency Boundaries &amp; Compensations
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Trading immediate ACID consistency for BASE (Basically Available, Soft State, Eventual Consistency) provides high throughput, 
            but requires robust mitigation of intermediate states (dirty reads, non-repeatable reads):
          </p>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 rounded-lg text-[11px] space-y-1.5">
            <strong>Dirty Read Isolation:</strong>
            <p className="leading-relaxed">
              If a seat is reserved under an active Saga, it is marked as <code className="bg-amber-500/10 px-1 rounded">RESERVED</code>. 
              The Booking microservice prevents other users from selecting it. If payment authorization fails later, compensation triggers 
              revert the row status back to <code className="bg-emerald-500/10 text-emerald-500 px-1 rounded font-bold">AVAILABLE</code>, 
              guaranteeing eventual consistency.
            </p>
          </div>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            The Saga Orchestrator implements an <strong>idempotent compensation matrix</strong>. Because external refund API requests or 
            un-reservation command queries may fail during cluster redeployments, every compensation task must run safely multiple times. 
            This is achieved by implementing unique composite transaction keys and <strong>Optimistic Concurrency Control</strong> 
            to prevent race conditions.
          </p>
        </div>

        {/* Section 4: RabbitMQ Reliability */}
        <div className="space-y-3" id="memo-rabbitmq-reliability">
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-655 dark:text-indigo-400 flex items-center gap-1.5 leading-none">
            <Layers className="h-4 w-4" />
            4. RabbitMQ Queue Integrity &amp; Poison Mitigation
          </h4>
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            Our message broker topology is designed under high-performance, fault-tolerant patterns:
          </p>
          <div className="space-y-2.5 font-sans" id="rabbitmq-specs">
            <div>
              <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-200">A. Idempotent Message Consumers</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                RabbitMQ provides **at-least-once** delivery guarantees, meaning network hiccups can cause duplicate messages. 
                We prevent duplicate processing by establishing **Inbox checks** on consumer databases. 
                Before processing any event payload, consumers verify if the message ID already exists as a unique key in the table. 
                Duplicates are discarded instantly without duplicating database operations.
              </span>
            </div>
            <div>
              <span className="block text-[11px] font-bold text-slate-700 dark:text-slate-200">B. Poison Message Processing &amp; DLQ Routing</span>
              <span className="block text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                If a message has invalid data or fails consistently (e.g. SMTP server connection outage in Notification Service), 
                retrying it forever blocks the queue. We implement a **retry policy** (3 attempts maximum). 
                Once this limit is exceeded, RabbitMQ routes the poisoned command to a dedicated **Dead-Letter Queue (DLQ)** 
                for engineering inspection and manual intervention, keeping active message queues unblocked.
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Production Readiness Checklist */}
      <div className="bg-slate-50 dark:bg-slate-950 p-5 rounded-xl border border-slate-200 dark:border-slate-800" id="readiness-checklist-block">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-1.5">
          <CheckSquare className="h-4 w-4 text-emerald-500" />
          5. Enterprise Architectural Production Readiness Checklist
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" id="checklist-grid">
          {[
            { title: 'Zero Shared Databases', desc: 'Each service strictly owns its catalog table schema inside dedicated database engines.' },
            { title: 'Optimistic Concurrency Tuning', desc: 'Optimistic locks (EF RowVersion/xmin) prevent double reservation issues.' },
            { title: 'Idempotency Guarantee', desc: 'Idempotence keys attached to REST commands prevent duplicate payments.' },
            { title: 'W3C Distributed Tracing', desc: 'Traceparent HTTP/AMQP headers pass parent trace context across cluster bounds.' },
            { title: 'Outbox Publisher Polling', desc: 'Dedicated publishers scan Outbox tables at 250ms intervals to publish messages.' },
            { title: 'AMQP Dead-Letter Queues (DLQ)', desc: 'Poisoned message states are redirected to DLQs to keep system streams clear.' }
          ].map((item, idx) => (
            <div key={idx} className="p-3 bg-white dark:bg-slate-900 border border-slate-150 dark:border-slate-850 rounded-lg text-[11px]">
              <span className="block font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <span className="h-2 w-2 bg-emerald-500 rounded-full shrink-0" />
                {item.title}
              </span>
              <span className="block text-slate-450 mt-1 leading-relaxed">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
