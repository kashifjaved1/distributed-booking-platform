import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, RotateCcw, AlertTriangle, CheckCircle2, Server, Database, 
  Mail, MessageSquare, Send, RefreshCw, Layers, ArrowRight, Activity, Zap
} from 'lucide-react';
import { Booking, SagaState, OutboxEntry, TraceLog, QueueMessage } from '../types';

interface MetricState {
  activeSagas: number;
  successCount: number;
  failureCount: number;
  compensationCount: number;
  retryCount: number;
  dlqCount: number;
}

export default function InteractiveSimulator() {
  // Inputs
  const [customerName, setCustomerName] = useState('Jane Cooper');
  const [seatNumber, setSeatNumber] = useState('14F');
  const [price, setPrice] = useState(157.50);
  const [scenarioMode, setScenarioMode] = useState<'success' | 'payment_fail' | 'ticket_fail' | 'email_fail'>('success');
  
  // Simulation State
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationStep, setSimulationStep] = useState<number>(-1);
  const [logs, setLogs] = useState<TraceLog[]>([]);
  const [selectedSpan, setSelectedSpan] = useState<TraceLog | null>(null);
  
  // Simulated DB / Entities
  const [currentBooking, setCurrentBooking] = useState<Booking | null>(null);
  const [sagaState, setSagaState] = useState<SagaState | null>(null);
  
  const [bookingOutbox, setBookingOutbox] = useState<OutboxEntry[]>([]);
  const [seatOutbox, setSeatOutbox] = useState<OutboxEntry[]>([]);
  const [paymentOutbox, setPaymentOutbox] = useState<OutboxEntry[]>([]);
  const [ticketOutbox, setTicketOutbox] = useState<OutboxEntry[]>([]);
  const [notificationOutbox, setNotificationOutbox] = useState<OutboxEntry[]>([]);
  
  // Real DB state (simulated)
  const [bookingDbTable, setBookingDbTable] = useState<Booking[]>([]);
  const [seatDbTable, setSeatDbTable] = useState<{ id: string, seatNumber: string, status: string }[]>([
    { id: '1', seatNumber: '12A', status: 'AVAILABLE' },
    { id: '2', seatNumber: '14F', status: 'AVAILABLE' },
    { id: '3', seatNumber: '22B', status: 'AVAILABLE' },
  ]);
  const [paymentDbTable, setPaymentDbTable] = useState<{ id: string, bookingId: string, amount: number, status: string }[]>([]);
  const [ticketDbTable, setTicketDbTable] = useState<{ id: string, bookingId: string, seatNumber: string, status: string }[]>([]);
  const [notificationDbTable, setNotificationDbTable] = useState<{ id: string, to: string, subject: string, status: string, retries: number }[]>([]);

  // RabbitMQ state
  const [queueMessages, setQueueMessages] = useState<QueueMessage[]>([]);
  const [activeQueue, setActiveQueue] = useState<string | null>(null);
  const [activeExchange, setActiveExchange] = useState<string | null>(null);

  // Key performance indicators (aggregated across sessions)
  const [metrics, setMetrics] = useState<MetricState>({
    activeSagas: 0,
    successCount: 142,
    failureCount: 18,
    compensationCount: 12,
    retryCount: 34,
    dlqCount: 2,
  });

  const correlationIdRef = useRef<string>('');
  const simulationTimer = useRef<NodeJS.Timeout | null>(null);
  const stepRef = useRef<number>(-1);

  // Clear or reset simulation
  const handleReset = () => {
    if (simulationTimer.current) {
      clearInterval(simulationTimer.current);
    }
    setIsSimulating(false);
    setSimulationStep(-1);
    stepRef.current = -1;
    setCurrentBooking(null);
    setSagaState(null);
    setBookingOutbox([]);
    setSeatOutbox([]);
    setPaymentOutbox([]);
    setTicketOutbox([]);
    setNotificationOutbox([]);
    // Reload seat table
    setSeatDbTable([
      { id: '1', seatNumber: '12A', status: 'AVAILABLE' },
      { id: '2', seatNumber: '14F', status: 'AVAILABLE' },
      { id: '3', seatNumber: '22B', status: 'AVAILABLE' },
    ]);
    setPaymentDbTable([]);
    setTicketDbTable([]);
    setNotificationDbTable([]);
    setQueueMessages([]);
    setActiveQueue(null);
    setActiveExchange(null);
    setLogs([]);
    setSelectedSpan(null);
  };

  const addTraceLog = (
    service: TraceLog['serviceName'],
    level: TraceLog['level'],
    message: string,
    details?: string,
    parentSpanId?: string
  ): string => {
    const spanId = `span-${Math.floor(100000 + Math.random() * 900000)}`;
    const newLog: TraceLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      serviceName: service,
      level,
      correlationId: correlationIdRef.current,
      spanId,
      parentSpanId,
      message,
      details,
    };
    setLogs(prev => [newLog, ...prev]);
    return spanId;
  };

  // Run the orchestrated steps
  const startSimulation = () => {
    handleReset();
    setIsSimulating(true);
    correlationIdRef.current = `tx-${Math.floor(100000 + Math.random() * 900000)}`;
    
    // Increment active sagas
    setMetrics(prev => ({ ...prev, activeSagas: prev.activeSagas + 1 }));

    stepRef.current = 0;
    setSimulationStep(0);
  };

  // Run individual step actions in useEffect
  useEffect(() => {
    if (!isSimulating || simulationStep === -1) return;

    const timer = setTimeout(() => {
      executeStep(simulationStep);
    }, 1500);

    return () => clearTimeout(timer);
  }, [simulationStep, isSimulating]);

  const executeStep = (step: number) => {
    const bookingId = `bk-${Math.floor(1000 + Math.random() * 9000)}`;
    const currentCorrelationId = correlationIdRef.current;

    switch (step) {
      // ==========================================
      // STEP 0: BOOKING INITIALIZED (Start Saga)
      // ==========================================
      case 0: {
        const rootSpan = addTraceLog(
          'Saga Orchestrator',
          'INFO',
          `Saga initiated for booking request. Customer=${customerName}, Seat=${seatNumber}`,
          JSON.stringify({ customerName, seatNumber, price, correlationId: currentCorrelationId }, null, 2)
        );

        // Atomic DB transaction block 
        const bookingSpan = addTraceLog(
          'Booking Service',
          'INFO',
          `DB Transaction started. Saving Booking aggregate (Status: PENDING) and inserting Outbox message.`,
          undefined,
          rootSpan
        );

        const newBooking: Booking = {
          id: bookingId,
          customerId: 'cust-102',
          seatNumber,
          amount: price,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        };
        setCurrentBooking(newBooking);
        setBookingDbTable(prev => [newBooking, ...prev]);

        const saga: SagaState = {
          sagaId: `saga-${Math.floor(100000 + Math.random() * 900000)}`,
          bookingId,
          customerId: 'cust-102',
          seatNumber,
          amount: price,
          currentState: 'SEAT_RESERVING',
          seatReserved: false,
          paymentAuthorized: false,
          ticketIssued: false,
          emailSent: false,
          retryCount: 0,
          maxRetries: 3,
          correlationId: currentCorrelationId,
          lastUpdated: new Date().toISOString(),
        };
        setSagaState(saga);

        // Transactional Outbox write in same DB transaction
        const outboxMsg: OutboxEntry = {
          id: `box-${Math.floor(100000 + Math.random() * 900000)}`,
          aggregateType: 'Booking',
          aggregateId: bookingId,
          eventType: 'BookingStartedEvent',
          payload: JSON.stringify({ bookingId, seatNumber, customerId: 'cust-102', price }),
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          correlationId: currentCorrelationId,
        };
        setBookingOutbox([outboxMsg]);

        addTraceLog(
          'Booking Service',
          'INFO',
          `DB Transaction committed atomically. Booking written to Bookings & OutboxMessage inserted.`,
          `Outbox ID: ${outboxMsg.id}\nStatus: PENDING`,
          bookingSpan
        );

        // Outbox Publisher Trigger
        setTimeout(() => {
          setBookingOutbox(prev => prev.map(m => m.id === outboxMsg.id ? { ...m, status: 'PUBLISHED', processedAt: new Date().toISOString() } : m));
          
          setActiveExchange('booking.exchange');
          addTraceLog(
            'Booking Service',
            'INFO',
            `Outbox Poller: Polled PENDING events. Publishing BookingStartedEvent to RabbitMQ 'booking.exchange'`,
            undefined,
            bookingSpan
          );

          // Route inside RabbitMQ broker
          const routeSpan = addTraceLog(
            'RabbitMQ',
            'INFO',
            `Exchange 'booking.exchange' routing message to queue 'seat.commands' via routing_key='seat.reserve'`,
            `Payload: ${outboxMsg.payload}`
          );

          const queueMsg: QueueMessage = {
            id: `msg-${Date.now()}`,
            exchange: 'booking.exchange',
            routingKey: 'seat.reserve',
            queue: 'seat.commands',
            correlationId: currentCorrelationId,
            payload: outboxMsg.payload,
            status: 'QUEUED',
            retryCount: 0,
          };
          setQueueMessages(prev => [...prev, queueMsg]);
          setActiveQueue('seat.commands');
        }, 600);

        setSimulationStep(1);
        break;
      }

      // ==========================================
      // STEP 1: SEAT RESERVATION SERVICE
      // ==========================================
      case 1: {
        setActiveExchange(null);
        setActiveQueue(null);

        // Consume queue message
        setQueueMessages(prev => prev.map(m => m.queue === 'seat.commands' ? { ...m, status: 'PROCESSED' } : m));
        
        const seatSpan = addTraceLog(
          'Seat Service',
          'INFO',
          `Message consumed from 'seat.commands'. Initiating idempotent seat reservation for ${seatNumber}.`,
          `CorrelationId: ${currentCorrelationId}`
        );

        // Database Write + Outbox in same transaction
        const dbTxSpan = addTraceLog(
          'Seat Service',
          'INFO',
          `DB Transaction inside SeatDB. Setting Seat status to RESERVED. Adding Outbox entry 'SeatReservedEvent'.`,
          undefined,
          seatSpan
        );

        // Lock & reserve seat
        setSeatDbTable(prev => prev.map(s => s.seatNumber === seatNumber ? { ...s, status: 'RESERVED' } : s));

        const seatOutboxMsg: OutboxEntry = {
          id: `box-${Math.floor(100000 + Math.random() * 900000)}`,
          aggregateType: 'Seat',
          aggregateId: seatNumber,
          eventType: 'SeatReservedEvent',
          payload: JSON.stringify({ bookingId: currentBooking?.id, seatNumber, customerId: 'cust-102' }),
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          correlationId: currentCorrelationId,
        };
        setSeatOutbox([seatOutboxMsg]);

        addTraceLog(
          'Seat Service',
          'INFO',
          `SeatDB Transaction committed. SeatReserved logged to outbox.`,
          undefined,
          dbTxSpan
        );

        // Outbox poller releases event
        setTimeout(() => {
          setSeatOutbox(prev => prev.map(m => m.id === seatOutboxMsg.id ? { ...m, status: 'PUBLISHED', processedAt: new Date().toISOString() } : m));
          setActiveExchange('seat.exchange');

          addTraceLog(
            'Seat Service',
            'INFO',
            `Outbox Publisher: Published SeatReservedEvent to RabbitMQ 'seat.exchange'`,
            undefined,
            seatSpan
          );

          addTraceLog(
            'RabbitMQ',
            'INFO',
            `Exchange 'seat.exchange' routed response to 'booking.commands' queue (Saga Orchestrator consumer)`,
            `Payload: ${seatOutboxMsg.payload}`
          );

          const qMsg: QueueMessage = {
            id: `msg-${Date.now()}`,
            exchange: 'seat.exchange',
            routingKey: 'booking.saga.seat_reserved',
            queue: 'booking.commands',
            correlationId: currentCorrelationId,
            payload: seatOutboxMsg.payload,
            status: 'QUEUED',
            retryCount: 0,
          };
          setQueueMessages(prev => [...prev, qMsg]);
          setActiveQueue('booking.commands');
        }, 600);

        setSimulationStep(2);
        break;
      }

      // ==========================================
      // STEP 2: SAGA CHECKS RESERVATION -> TRIGGERS PAYMENT OR COMPENSATION
      // ==========================================
      case 2: {
        setActiveExchange(null);
        setActiveQueue(null);
        setQueueMessages(prev => prev.map(m => m.queue === 'booking.commands' ? { ...m, status: 'PROCESSED' } : m));

        addTraceLog(
          'Saga Orchestrator',
          'INFO',
          `Saga Orchestrator consumed 'SeatReservedEvent'. Transitioning state: SEAT_RESERVING ➔ SEAT_RESERVED.`,
          `Updating SagaStateDB record.`
        );

        setSagaState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            currentState: 'PAYMENT_AUTHORIZING',
            seatReserved: true,
            lastUpdated: new Date().toISOString()
          };
        });

        // Trigger Payment request command via transactional outbox
        const sagaOutboxMsg: OutboxEntry = {
          id: `box-${Math.floor(100000 + Math.random() * 900000)}`,
          aggregateType: 'Booking',
          aggregateId: currentBooking?.id || '',
          eventType: 'AuthorizePaymentCommand',
          payload: JSON.stringify({ bookingId: currentBooking?.id, customerId: 'cust-102', amount: price }),
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          correlationId: currentCorrelationId,
        };
        setBookingOutbox(prev => [...prev, sagaOutboxMsg]);

        setTimeout(() => {
          setBookingOutbox(prev => prev.map(m => m.id === sagaOutboxMsg.id ? { ...m, status: 'PUBLISHED', processedAt: new Date().toISOString() } : m));
          setActiveExchange('booking.exchange');

          addTraceLog(
            'Saga Orchestrator',
            'INFO',
            `Outbox Publisher: Published Command 'AuthorizePaymentCommand' targeting Payment Service.`,
            undefined
          );

          addTraceLog(
            'RabbitMQ',
            'INFO',
            `Exchange 'booking.exchange' routing payment authorization token to queue 'payment.commands'.`,
            `Payload: ${sagaOutboxMsg.payload}`
          );

          const qMsg: QueueMessage = {
            id: `msg-${Date.now()}`,
            exchange: 'booking.exchange',
            routingKey: 'payment.authorize',
            queue: 'payment.commands',
            correlationId: currentCorrelationId,
            payload: sagaOutboxMsg.payload,
            status: 'QUEUED',
            retryCount: 0,
          };
          setQueueMessages(prev => [...prev, qMsg]);
          setActiveQueue('payment.commands');
        }, 600);

        setSimulationStep(3);
        break;
      }

      // ==========================================
      // STEP 3: PAYMENT AUTHORIZATION (Success / Failure scenarios)
      // ==========================================
      case 3: {
        setActiveExchange(null);
        setActiveQueue(null);
        setQueueMessages(prev => prev.map(m => m.queue === 'payment.commands' ? { ...m, status: 'PROCESSED' } : m));

        const isFailPath = scenarioMode === 'payment_fail';
        
        const paySpan = addTraceLog(
          'Payment Service',
          isFailPath ? 'WARN' : 'INFO',
          isFailPath 
            ? `Message consumed from 'payment.commands'. Processing authorization of $${price.toFixed(2)}. Gateway rejected: Insufficient Funds.`
            : `Message consumed from 'payment.commands'. Processing authorization of $${price.toFixed(2)}. Gateway: Approved.`,
          `CorrelationID: ${currentCorrelationId}`
        );

        const dbTxSpan = addTraceLog(
          'Payment Service',
          isFailPath ? 'WARN' : 'INFO',
          `DB Transaction inside PaymentDB. Creating PaymentTransaction (Record Status: ${isFailPath ? 'DECLINED' : 'AUTHORIZED'}). Adding Outbox event.`,
          undefined,
          paySpan
        );

        // DB record
        const paymentTxId = `pay-${Math.floor(1000 + Math.random() * 9000)}`;
        setPaymentDbTable(prev => [
          { id: paymentTxId, bookingId: currentBooking?.id || '', amount: price, status: isFailPath ? 'DECLINED' : 'AUTHORIZED' },
          ...prev
        ]);

        // Outbox event
        const paymentOutboxMsg: OutboxEntry = {
          id: `box-${Math.floor(100000 + Math.random() * 900000)}`,
          aggregateType: 'Payment',
          aggregateId: paymentTxId,
          eventType: isFailPath ? 'PaymentAuthorizationFailedEvent' : 'PaymentAuthorizedEvent',
          payload: JSON.stringify({ bookingId: currentBooking?.id, amount: price, paymentTxId, errorCode: isFailPath ? 'INSUFFICIENT_FUNDS' : null }),
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          correlationId: currentCorrelationId,
        };
        setPaymentOutbox([paymentOutboxMsg]);

        addTraceLog(
          'Payment Service',
          isFailPath ? 'WARN' : 'INFO',
          `PaymentDB transaction committed. Outbox record logged.`,
          undefined,
          dbTxSpan
        );

        setTimeout(() => {
          setPaymentOutbox(prev => prev.map(m => m.id === paymentOutboxMsg.id ? { ...m, status: 'PUBLISHED', processedAt: new Date().toISOString() } : m));
          setActiveExchange('payment.exchange');

          addTraceLog(
            'Payment Service',
            'INFO',
            `Outbox Publisher: Published event standard payload to 'payment.exchange'`,
            undefined,
            paySpan
          );

          addTraceLog(
            'RabbitMQ',
            'INFO',
            `Exchange 'payment.exchange' routing reply to Saga Orchestrator inbox queue 'booking.commands'`,
            `Payload: ${paymentOutboxMsg.payload}`
          );

          const qMsg: QueueMessage = {
            id: `msg-${Date.now()}`,
            exchange: 'payment.exchange',
            routingKey: isFailPath ? 'booking.saga.payment_failed' : 'booking.saga.payment_authorized',
            queue: 'booking.commands',
            correlationId: currentCorrelationId,
            payload: paymentOutboxMsg.payload,
            status: 'QUEUED',
            retryCount: 0,
          };
          setQueueMessages(prev => [...prev, qMsg]);
          setActiveQueue('booking.commands');
        }, 600);

        if (isFailPath) {
          // Send to Compensation branch next hook
          setSimulationStep(10); // 10 is Seat Compensation path
        } else {
          setSimulationStep(4); // 4 is Ticket branch
        }
        break;
      }

      // ==========================================
      // STEP 4: SAGA INGESTS PAYMENT SUCCESS -> ISSUE TICKET
      // ==========================================
      case 4: {
        setActiveExchange(null);
        setActiveQueue(null);
        setQueueMessages(prev => prev.map(m => m.queue === 'booking.commands' ? { ...m, status: 'PROCESSED' } : m));

        addTraceLog(
          'Saga Orchestrator',
          'INFO',
          `Saga Orchestrator consumed 'PaymentAuthorizedEvent'. Transitioning state: PAYMENT_AUTHORIZING ➔ PAYMENT_AUTHORIZED.`,
          `Saving transaction checkpoint state.`
        );

        setSagaState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            currentState: 'TICKET_ISSUING',
            paymentAuthorized: true,
            lastUpdated: new Date().toISOString()
          };
        });

        // Event of trigger ticket issuances
        const sagaOutboxMsg: OutboxEntry = {
          id: `box-${Math.floor(100000 + Math.random() * 900000)}`,
          aggregateType: 'Booking',
          aggregateId: currentBooking?.id || '',
          eventType: 'IssueTicketCommand',
          payload: JSON.stringify({ bookingId: currentBooking?.id, seatNumber, customerId: 'cust-102' }),
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          correlationId: currentCorrelationId,
        };
        setBookingOutbox(prev => [...prev, sagaOutboxMsg]);

        setTimeout(() => {
          setBookingOutbox(prev => prev.map(m => m.id === sagaOutboxMsg.id ? { ...m, status: 'PUBLISHED', processedAt: new Date().toISOString() } : m));
          setActiveExchange('booking.exchange');

          addTraceLog(
            'Saga Orchestrator',
            'INFO',
            `Outbox Publisher: Published 'IssueTicketCommand' outbox to RabbitMQ broker`,
            undefined
          );

          addTraceLog(
            'RabbitMQ',
            'INFO',
            `Routing command ticket message to queue 'ticket.commands'.`,
            `Payload: ${sagaOutboxMsg.payload}`
          );

          const qMsg: QueueMessage = {
            id: `msg-${Date.now()}`,
            exchange: 'booking.exchange',
            routingKey: 'ticket.issue',
            queue: 'ticket.commands',
            correlationId: currentCorrelationId,
            payload: sagaOutboxMsg.payload,
            status: 'QUEUED',
            retryCount: 0,
          };
          setQueueMessages(prev => [...prev, qMsg]);
          setActiveQueue('ticket.commands');
        }, 600);

        setSimulationStep(5);
        break;
      }

      // ==========================================
      // STEP 5: TICKET SERVICE (Success / Failure Paths)
      // ==========================================
      case 5: {
        setActiveExchange(null);
        setActiveQueue(null);
        setQueueMessages(prev => prev.map(m => m.queue === 'ticket.commands' ? { ...m, status: 'PROCESSED' } : m));

        const isFailPath = scenarioMode === 'ticket_fail';

        const tickSpan = addTraceLog(
          'Ticket Service',
          isFailPath ? 'WARN' : 'INFO',
          isFailPath
            ? `Message consumed from 'ticket.commands'. Generating ticket asset. CRITICAL FAULT: PDF layout generation engine runtime exception.`
            : `Message consumed from 'ticket.commands'. Generating ticket asset. Completed. Ticket issued successfully.`,
          `CorrelationID: ${currentCorrelationId}`
        );

        const dbTxSpan = addTraceLog(
          'Ticket Service',
          isFailPath ? 'WARN' : 'INFO',
          `DB Transaction inside TicketDB. Creating Ticket record (Status: ${isFailPath ? 'FAILED_GENERATION' : 'ISSUED'}). Writing Outbox event.`,
          undefined,
          tickSpan
        );

        // Database inserts
        const ticketId = `tkt-${Math.floor(1000 + Math.random() * 9000)}`;
        if (!isFailPath) {
          setTicketDbTable(prev => [
            { id: ticketId, bookingId: currentBooking?.id || '', seatNumber, status: 'ACTIVE' },
            ...prev
          ]);
        }

        // Outbox payload
        const tickOutboxMsg: OutboxEntry = {
          id: `box-${Math.floor(100000 + Math.random() * 900000)}`,
          aggregateType: 'Ticket',
          aggregateId: ticketId,
          eventType: isFailPath ? 'TicketIssueFailedEvent' : 'TicketIssuedEvent',
          payload: JSON.stringify({ bookingId: currentBooking?.id, ticketId: isFailPath ? null : ticketId, seatNumber, customerId: 'cust-102' }),
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          correlationId: currentCorrelationId,
        };
        setTicketOutbox([tickOutboxMsg]);

        addTraceLog(
          'Ticket Service',
          isFailPath ? 'WARN' : 'INFO',
          `TicketDB updates saved. Event registered to outbox.`,
          undefined,
          dbTxSpan
        );

        setTimeout(() => {
          setTicketOutbox(prev => prev.map(m => m.id === tickOutboxMsg.id ? { ...m, status: 'PUBLISHED', processedAt: new Date().toISOString() } : m));
          setActiveExchange('ticket.exchange');

          addTraceLog(
            'Ticket Service',
            'INFO',
            `Outbox Publisher: Published state response outbox to 'ticket.exchange'`,
            undefined,
            tickSpan
          );

          addTraceLog(
            'RabbitMQ',
            'INFO',
            `Exchange 'ticket.exchange' routing reply payload to Saga orchestrator consumer 'booking.commands'.`,
            `Payload: ${tickOutboxMsg.payload}`
          );

          const qMsg: QueueMessage = {
            id: `msg-${Date.now()}`,
            exchange: 'ticket.exchange',
            routingKey: isFailPath ? 'booking.saga.ticket_failed' : 'booking.saga.ticket_issued',
            queue: 'booking.commands',
            correlationId: currentCorrelationId,
            payload: tickOutboxMsg.payload,
            status: 'QUEUED',
            retryCount: 0,
          };
          setQueueMessages(prev => [...prev, qMsg]);
          setActiveQueue('booking.commands');
        }, 600);

        if (isFailPath) {
          // Transition to multi-service compensation chain 
          setSimulationStep(20); // 20 is Payment Refund compensation path
        } else {
          setSimulationStep(6); // 6 is Notification path
        }
        break;
      }

      // ==========================================
      // STEP 6: SAGA TICKETING COMPLETED -> EMAIL SENDING
      // ==========================================
      case 6: {
        setActiveExchange(null);
        setActiveQueue(null);
        setQueueMessages(prev => prev.map(m => m.queue === 'booking.commands' ? { ...m, status: 'PROCESSED' } : m));

        addTraceLog(
          'Saga Orchestrator',
          'INFO',
          `Saga Orchestrator consumed 'TicketIssuedEvent'. Transitioning state: TICKET_ISSUING ➔ TICKET_ISSUED.`,
          `Checkpointing transactions.`
        );

        setSagaState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            currentState: 'EMAIL_SENDING',
            ticketIssued: true,
            lastUpdated: new Date().toISOString()
          };
        });

        const emailOutboxMsg: OutboxEntry = {
          id: `box-${Math.floor(100000 + Math.random() * 900000)}`,
          aggregateType: 'Booking',
          aggregateId: currentBooking?.id || '',
          eventType: 'SendNotificationCommand',
          payload: JSON.stringify({ bookingId: currentBooking?.id, customerName, email: 'user@gmail.com', seatNumber }),
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          correlationId: currentCorrelationId,
        };
        setBookingOutbox(prev => [...prev, emailOutboxMsg]);

        setTimeout(() => {
          setBookingOutbox(prev => prev.map(m => m.id === emailOutboxMsg.id ? { ...m, status: 'PUBLISHED', processedAt: new Date().toISOString() } : m));
          setActiveExchange('booking.exchange');

          addTraceLog(
            'Saga Orchestrator',
            'INFO',
            `Outbox Publisher: Published 'SendNotificationCommand' targeting Notification Service.`,
            undefined
          );

          addTraceLog(
            'RabbitMQ',
            'INFO',
            `Exchange 'booking.exchange' routing command to 'notification.commands' queue.`,
            `Payload: ${emailOutboxMsg.payload}`
          );

          const qMsg: QueueMessage = {
            id: `msg-${Date.now()}`,
            exchange: 'booking.exchange',
            routingKey: 'notification.send',
            queue: 'notification.commands',
            correlationId: currentCorrelationId,
            payload: emailOutboxMsg.payload,
            status: 'QUEUED',
            retryCount: 0,
          };
          setQueueMessages(prev => [...prev, qMsg]);
          setActiveQueue('notification.commands');
        }, 600);

        setSimulationStep(7);
        break;
      }

      // ==========================================
      // STEP 7: NOTIFICATION SERVICE (Email Fail/Success handling)
      // ==========================================
      case 7: {
        setActiveExchange(null);
        setActiveQueue(null);
        
        const isFailPath = scenarioMode === 'email_fail';
        
        if (isFailPath) {
          // Mark queue message as RETRIED, simulating poison/failure
          setQueueMessages(prev => prev.map(m => m.queue === 'notification.commands' ? { ...m, status: 'RETRIED', retryCount: m.retryCount + 1 } : m));
          
          setMetrics(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));

          const mailSpan = addTraceLog(
            'Notification Service',
            'ERROR',
            `Message consumed from 'notification.commands'. Attempting confirmation email dispatch. SMTPServerConnectionException: SMTP connection timed out.`,
            `Recipient: user@gmail.com. Initializing exponential backoff retry policy...`
          );

          // Insert into Email Log table with retry status
          setNotificationDbTable(prev => [
            { id: `mail-${Math.floor(1000 + Math.random() * 9000)}`, to: 'user@gmail.com', subject: 'Your Booking Confirmed!', status: 'FAILED_RETRYING', retries: 1 },
            ...prev
          ]);

          // We simulate a Dead Letter Queue (DLQ) route since it failed
          setTimeout(() => {
            addTraceLog(
              'RabbitMQ',
              'WARN',
              `Retry policy threshold reached in consumer. Routing poisoned notification command to Dead Letter Queue 'notification.dlq'`,
              `Message marked as dead letter to avoid blocking queue.`
            );

            setQueueMessages(prev => prev.map(m => m.queue === 'notification.commands' ? { ...m, status: 'DLQ' } : m));
            setMetrics(prev => ({ ...prev, dlqCount: prev.dlqCount + 1 }));
            setActiveQueue('notification.dlq');
          }, 600);

          // The Saga completes anyway! Since Notification failure is non-disruptive to the booking (Doesn't roll back booking, just retries in background)
          setSimulationStep(8);
        } else {
          // SUCCESS PATH
          setQueueMessages(prev => prev.map(m => m.queue === 'notification.commands' ? { ...m, status: 'PROCESSED' } : m));

          const mailSpan = addTraceLog(
            'Notification Service',
            'INFO',
            `Message consumed from 'notification.commands'. Confirmation email dispatched successfully.`,
            `To: user@gmail.com\nSubject: Booking confirmation ticket ${seatNumber}`
          );

          const dbTxSpan = addTraceLog(
            'Notification Service',
            'INFO',
            `DB Transaction inside NotificationDB. Creating EmailLog record. Creating Outbox event.`,
            undefined,
            mailSpan
          );

          setNotificationDbTable(prev => [
            { id: `mail-${Math.floor(1000 + Math.random() * 9000)}`, to: 'user@gmail.com', subject: 'Your Booking Confirmed!', status: 'SENT', retries: 0 },
            ...prev
          ]);

          const notifOutboxMsg: OutboxEntry = {
            id: `box-${Math.floor(100000 + Math.random() * 900000)}`,
            aggregateType: 'Notification',
            aggregateId: 'mail-102',
            eventType: 'EmailSentEvent',
            payload: JSON.stringify({ bookingId: currentBooking?.id, to: 'user@gmail.com', status: 'SENT' }),
            status: 'PENDING',
            createdAt: new Date().toISOString(),
            correlationId: currentCorrelationId,
          };
          setNotificationOutbox([notifOutboxMsg]);

          addTraceLog(
            'Notification Service',
            'INFO',
            `NotificationDB committed. Outbox record created.`,
            undefined,
            dbTxSpan
          );

          setTimeout(() => {
            setNotificationOutbox(prev => prev.map(m => m.id === notifOutboxMsg.id ? { ...m, status: 'PUBLISHED', processedAt: new Date().toISOString() } : m));
            setActiveExchange('notification.exchange');

            addTraceLog(
              'Notification Service',
              'INFO',
              `Outbox Publisher: Published EmailSentEvent outbox record to 'notification.exchange'`,
              undefined,
              mailSpan
            );

            addTraceLog(
              'RabbitMQ',
              'INFO',
              `Exchange 'notification.exchange' routing reply to Saga coordinator queue 'booking.commands'.`,
              `Payload: ${notifOutboxMsg.payload}`
            );

            const qMsg: QueueMessage = {
              id: `msg-${Date.now()}`,
              exchange: 'notification.exchange',
              routingKey: 'booking.saga.email_sent',
              queue: 'booking.commands',
              correlationId: currentCorrelationId,
              payload: notifOutboxMsg.payload,
              status: 'QUEUED',
              retryCount: 0,
            };
            setQueueMessages(prev => [...prev, qMsg]);
            setActiveQueue('booking.commands');
          }, 600);

          setSimulationStep(8);
        }
        break;
      }

      // ==========================================
      // STEP 8: SAGA FINAL COMPLETED CHECKPOINT
      // ==========================================
      case 8: {
        setActiveExchange(null);
        setActiveQueue(null);
        setQueueMessages(prev => prev.map(m => m.queue === 'booking.commands' ? { ...m, status: 'PROCESSED' } : m));

        addTraceLog(
          'Saga Orchestrator',
          'INFO',
          `Saga Orchestrator finishes executing steps. Marking booking transaction as COMPLETED. Updating Booking state to CONFIRMED.`,
          `Saga ID: ${sagaState?.sagaId}\nBooking ID: ${currentBooking?.id}`
        );

        setSagaState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            currentState: 'COMPLETED',
            emailSent: scenarioMode !== 'email_fail',
            lastUpdated: new Date().toISOString()
          };
        });

        // Atomic update booking DB to Confirmed
        setCurrentBooking(prev => {
          if (!prev) return null;
          return { ...prev, status: 'CONFIRMED' };
        });
        setBookingDbTable(prev => prev.map(b => b.id === currentBooking?.id ? { ...b, status: 'CONFIRMED' } : b));

        // Increment Success Metrics
        setMetrics(prev => ({
          ...prev,
          activeSagas: Math.max(0, prev.activeSagas - 1),
          successCount: prev.successCount + 1
        }));

        setIsSimulating(false);
        break;
      }

      // ==========================================
      // STEP 10: SAGA REVERSES SEAT ONLY (After Payment Auth Failure)
      // ==========================================
      case 10: {
        setActiveExchange(null);
        setActiveQueue(null);
        setQueueMessages(prev => prev.map(m => m.queue === 'booking.commands' ? { ...m, status: 'PROCESSED' } : m));

        addTraceLog(
          'Saga Orchestrator',
          'WARN',
          `Saga Orchestrator received 'PaymentAuthorizationFailedEvent'. Transitioning state: SEAT_RESERVED ➔ COMPENSATING_SEAT.`,
          `Commencing compensation flow to release seat reservation.`
        );

        setSagaState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            currentState: 'COMPENSATING_SEAT',
            lastUpdated: new Date().toISOString()
          };
        });

        // Compensation command in the outbox
        const sagaOutboxMsg: OutboxEntry = {
          id: `box-${Math.floor(100000 + Math.random() * 900000)}`,
          aggregateType: 'Booking',
          aggregateId: currentBooking?.id || '',
          eventType: 'ReleaseSeatCommand',
          payload: JSON.stringify({ bookingId: currentBooking?.id, seatNumber }),
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          correlationId: currentCorrelationId,
        };
        setBookingOutbox(prev => [...prev, sagaOutboxMsg]);

        setTimeout(() => {
          setBookingOutbox(prev => prev.map(m => m.id === sagaOutboxMsg.id ? { ...m, status: 'PUBLISHED', processedAt: new Date().toISOString() } : m));
          setActiveExchange('booking.exchange');

          addTraceLog(
            'Saga Orchestrator',
            'INFO',
            `Outbox Publisher: Published Compensation command 'ReleaseSeatCommand' to RabbitMQ.`,
            undefined
          );

          addTraceLog(
            'RabbitMQ',
            'INFO',
            `Routing Seat Release compensation command to queue 'seat.commands'.`,
            `Payload: ${sagaOutboxMsg.payload}`
          );

          const qMsg: QueueMessage = {
            id: `msg-${Date.now()}`,
            exchange: 'booking.exchange',
            routingKey: 'seat.release',
            queue: 'seat.commands',
            correlationId: currentCorrelationId,
            payload: sagaOutboxMsg.payload,
            status: 'QUEUED',
            retryCount: 0,
          };
          setQueueMessages(prev => [...prev, qMsg]);
          setActiveQueue('seat.commands');
        }, 600);

        setSimulationStep(11);
        break;
      }

      // ==========================================
      // STEP 11: SEAT SERVICE CONSUMES COMPENSATION (After Payment Auth Failure)
      // ==========================================
      case 11: {
        setActiveExchange(null);
        setActiveQueue(null);
        setQueueMessages(prev => prev.map(m => m.queue === 'seat.commands' ? { ...m, status: 'PROCESSED' } : m));

        const compSpan = addTraceLog(
          'Seat Service',
          'INFO',
          `Message consumed from 'seat.commands'. Activating seat compensation for seat=${seatNumber}.`,
          `Releasing locked seat inventory.`
        );

        const dbTxSpan = addTraceLog(
          'Seat Service',
          'INFO',
          `DB Transaction inside SeatDB. Reverting Seat status from RESERVED ➔ AVAILABLE. Generating outbox compensation reply.`,
          undefined,
          compSpan
        );

        setSeatDbTable(prev => prev.map(s => s.seatNumber === seatNumber ? { ...s, status: 'AVAILABLE' } : s));

        const seatOutboxMsg: OutboxEntry = {
          id: `box-${Math.floor(100000 + Math.random() * 900000)}`,
          aggregateType: 'Seat',
          aggregateId: seatNumber,
          eventType: 'SeatReleasedEvent',
          payload: JSON.stringify({ bookingId: currentBooking?.id, seatNumber, status: 'AVAILABLE' }),
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          correlationId: currentCorrelationId,
        };
        setSeatOutbox(prev => [...prev, seatOutboxMsg]);

        addTraceLog(
          'Seat Service',
          'INFO',
          `SeatDB compensation completed. Reasserted seat availability. Outbox queued.`,
          undefined,
          dbTxSpan
        );

        setTimeout(() => {
          setSeatOutbox(prev => prev.map(m => m.id === seatOutboxMsg.id ? { ...m, status: 'PUBLISHED', processedAt: new Date().toISOString() } : m));
          setActiveExchange('seat.exchange');

          addTraceLog(
            'Seat Service',
            'INFO',
            `Outbox Publisher: Published SeatReleasedEvent to RabbitMQ 'seat.exchange'`,
            undefined
          );

          addTraceLog(
            'RabbitMQ',
            'INFO',
            `Routing reply to Saga Orchestrator box 'booking.commands'.`,
            `Payload: ${seatOutboxMsg.payload}`
          );

          const qMsg: QueueMessage = {
            id: `msg-${Date.now()}`,
            exchange: 'seat.exchange',
            routingKey: 'booking.saga.seat_released',
            queue: 'booking.commands',
            correlationId: currentCorrelationId,
            payload: seatOutboxMsg.payload,
            status: 'QUEUED',
            retryCount: 0,
          };
          setQueueMessages(prev => [...prev, qMsg]);
          setActiveQueue('booking.commands');
        }, 600);

        setSimulationStep(12);
        break;
      }

      // ==========================================
      // STEP 12: SAGA FINALIZED FAILURE STATUS (Payment Auth Failure Completed)
      // ==========================================
      case 12: {
        setActiveExchange(null);
        setActiveQueue(null);
        setQueueMessages(prev => prev.map(m => m.queue === 'booking.commands' ? { ...m, status: 'PROCESSED' } : m));

        addTraceLog(
          'Saga Orchestrator',
          'WARN',
          `Saga Orchestrator consumed 'SeatReleasedEvent'. Compensation complete. Booking rejected due to payment failures.`,
          undefined
        );

        setSagaState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            currentState: 'FAILED',
            lastUpdated: new Date().toISOString()
          };
        });

        setCurrentBooking(prev => {
          if (!prev) return null;
          return { ...prev, status: 'REJECTED' };
        });
        setBookingDbTable(prev => prev.map(b => b.id === currentBooking?.id ? { ...b, status: 'REJECTED' } : b));

        setMetrics(prev => ({
          ...prev,
          activeSagas: Math.max(0, prev.activeSagas - 1),
          failureCount: prev.failureCount + 1,
          compensationCount: prev.compensationCount + 1
        }));

        setIsSimulating(false);
        break;
      }

      // ==========================================
      // STEP 20: COMPENSATION REFUND PAYMENT (After Ticket Generation failure)
      // ==========================================
      case 20: {
        setActiveExchange(null);
        setActiveQueue(null);
        setQueueMessages(prev => prev.map(m => m.queue === 'booking.commands' ? { ...m, status: 'PROCESSED' } : m));

        addTraceLog(
          'Saga Orchestrator',
          'WARN',
          `Saga Orchestrator received 'TicketIssueFailedEvent'. Transitioning state: TICKET_ISSUING ➔ COMPENSATING_PAYMENT.`,
          `Commencing compensation chain. Step 1: Refund charged amount $${price.toFixed(2)}.`
        );

        setSagaState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            currentState: 'COMPENSATING_PAYMENT',
            lastUpdated: new Date().toISOString()
          };
        });

        // Compensation in booking outbox targeting Payment Service
        const sagaOutboxMsg: OutboxEntry = {
          id: `box-${Math.floor(100000 + Math.random() * 900000)}`,
          aggregateType: 'Booking',
          aggregateId: currentBooking?.id || '',
          eventType: 'RefundPaymentCommand',
          payload: JSON.stringify({ bookingId: currentBooking?.id, amount: price }),
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          correlationId: currentCorrelationId,
        };
        setBookingOutbox(prev => [...prev, sagaOutboxMsg]);

        setTimeout(() => {
          setBookingOutbox(prev => prev.map(m => m.id === sagaOutboxMsg.id ? { ...m, status: 'PUBLISHED', processedAt: new Date().toISOString() } : m));
          setActiveExchange('booking.exchange');

          addTraceLog(
            'Saga Orchestrator',
            'INFO',
            `Outbox Publisher: Published Compensation command 'RefundPaymentCommand' to broker.`,
            undefined
          );

          addTraceLog(
            'RabbitMQ',
            'INFO',
            `Routing Refund payment compensation command to queue 'payment.commands'.`,
            `Payload: ${sagaOutboxMsg.payload}`
          );

          const qMsg: QueueMessage = {
            id: `msg-${Date.now()}`,
            exchange: 'booking.exchange',
            routingKey: 'payment.refund',
            queue: 'payment.commands',
            correlationId: currentCorrelationId,
            payload: sagaOutboxMsg.payload,
            status: 'QUEUED',
            retryCount: 0,
          };
          setQueueMessages(prev => [...prev, qMsg]);
          setActiveQueue('payment.commands');
        }, 600);

        setSimulationStep(21);
        break;
      }

      // ==========================================
      // STEP 21: PAYMENT SERVICE PERFORMS REFUND (After Ticket Failure)
      // ==========================================
      case 21: {
        setActiveExchange(null);
        setActiveQueue(null);
        setQueueMessages(prev => prev.map(m => m.queue === 'payment.commands' ? { ...m, status: 'PROCESSED' } : m));

        const compSpan = addTraceLog(
          'Payment Service',
          'INFO',
          `Message consumed from 'payment.commands'. Invoking gateway void/refund API for booking=${currentBooking?.id}.`,
          `Refunding transaction value: $${price.toFixed(2)}`
        );

        const dbTxSpan = addTraceLog(
          'Payment Service',
          'INFO',
          `DB Transaction in PaymentDB. Setting PaymentTransaction status from AUTHORIZED ➔ REFUNDED. Adding outbox response.`,
          undefined,
          compSpan
        );

        // Refund payment DB record Status
        setPaymentDbTable(prev => prev.map(p => p.bookingId === currentBooking?.id ? { ...p, status: 'REFUNDED' } : p));

        const payOutboxMsg: OutboxEntry = {
          id: `box-${Math.floor(100000 + Math.random() * 900000)}`,
          aggregateType: 'Payment',
          aggregateId: 'pay-102',
          eventType: 'PaymentRefundedEvent',
          payload: JSON.stringify({ bookingId: currentBooking?.id, amount: price, status: 'REFUNDED' }),
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          correlationId: currentCorrelationId,
        };
        setPaymentOutbox(prev => [...prev, payOutboxMsg]);

        addTraceLog(
          'Payment Service',
          'INFO',
          `PaymentDB void saved. PaymentRefunded logged to outbox.`,
          undefined,
          dbTxSpan
        );

        setTimeout(() => {
          setPaymentOutbox(prev => prev.map(m => m.id === payOutboxMsg.id ? { ...m, status: 'PUBLISHED', processedAt: new Date().toISOString() } : m));
          setActiveExchange('payment.exchange');

          addTraceLog(
            'Payment Service',
            'INFO',
            `Outbox Publisher: Published event standard payload to 'payment.exchange'`,
            undefined
          );

          addTraceLog(
            'RabbitMQ',
            'INFO',
            `Routing reply notification to Saga Orchestrator queue 'booking.commands'.`,
            `Payload: ${payOutboxMsg.payload}`
          );

          const qMsg: QueueMessage = {
            id: `msg-${Date.now()}`,
            exchange: 'payment.exchange',
            routingKey: 'booking.saga.payment_refunded',
            queue: 'booking.commands',
            correlationId: currentCorrelationId,
            payload: payOutboxMsg.payload,
            status: 'QUEUED',
            retryCount: 0,
          };
          setQueueMessages(prev => [...prev, qMsg]);
          setActiveQueue('booking.commands');
        }, 600);

        setSimulationStep(22);
        break;
      }

      // ==========================================
      // STEP 22: SAGA RESPONDS RELEASES SEAT (After Ticket + Payment Refund completed)
      // ==========================================
      case 22: {
        setActiveExchange(null);
        setActiveQueue(null);
        setQueueMessages(prev => prev.map(m => m.queue === 'booking.commands' ? { ...m, status: 'PROCESSED' } : m));

        addTraceLog(
          'Saga Orchestrator',
          'WARN',
          `Saga Orchestrator consumed 'PaymentRefundedEvent'. Progressing compensation chain. Step 2: Release seat reservation.`,
          `Transitioning state: COMPENSATING_PAYMENT ➔ COMPENSATING_SEAT`
        );

        setSagaState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            currentState: 'COMPENSATING_SEAT',
            lastUpdated: new Date().toISOString()
          };
        });

        // Compensation command in outbox targeting Seat Service
        const sagaOutboxMsg: OutboxEntry = {
          id: `box-${Math.floor(100000 + Math.random() * 900000)}`,
          aggregateType: 'Booking',
          aggregateId: currentBooking?.id || '',
          eventType: 'ReleaseSeatCommand',
          payload: JSON.stringify({ bookingId: currentBooking?.id, seatNumber }),
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          correlationId: currentCorrelationId,
        };
        setBookingOutbox(prev => [...prev, sagaOutboxMsg]);

        setTimeout(() => {
          setBookingOutbox(prev => prev.map(m => m.id === sagaOutboxMsg.id ? { ...m, status: 'PUBLISHED', processedAt: new Date().toISOString() } : m));
          setActiveExchange('booking.exchange');

          addTraceLog(
            'Saga Orchestrator',
            'INFO',
            `Outbox Publisher: Published Command 'ReleaseSeatCommand' targeting Seat Service.`,
            undefined
          );

          addTraceLog(
            'RabbitMQ',
            'INFO',
            `Routing release seat key to queue 'seat.commands'.`,
            `Payload: ${sagaOutboxMsg.payload}`
          );

          const qMsg: QueueMessage = {
            id: `msg-${Date.now()}`,
            exchange: 'booking.exchange',
            routingKey: 'seat.release',
            queue: 'seat.commands',
            correlationId: currentCorrelationId,
            payload: sagaOutboxMsg.payload,
            status: 'QUEUED',
            retryCount: 0,
          };
          setQueueMessages(prev => [...prev, qMsg]);
          setActiveQueue('seat.commands');
        }, 600);

        setSimulationStep(23);
        break;
      }

      // ==========================================
      // STEP 23: SEAT SERVICE PERFORMS COMPENSATION SECOND TIME (After Ticket Failure)
      // ==========================================
      case 23: {
        setActiveExchange(null);
        setActiveQueue(null);
        setQueueMessages(prev => prev.map(m => m.queue === 'seat.commands' ? { ...m, status: 'PROCESSED' } : m));

        const compSpan = addTraceLog(
          'Seat Service',
          'INFO',
          `Message consumed from 'seat.commands'. Executing compensation routine for seat=${seatNumber}.`,
          `Unlocking inventory.`
        );

        const dbTxSpan = addTraceLog(
          'Seat Service',
          'INFO',
          `DB Transaction inside SeatDB. Setting Seat status RESERVED ➔ AVAILABLE. Writing outbox representation.`,
          undefined,
          compSpan
        );

        setSeatDbTable(prev => prev.map(s => s.seatNumber === seatNumber ? { ...s, status: 'AVAILABLE' } : s));

        const seatOutboxMsg: OutboxEntry = {
          id: `box-${Math.floor(100000 + Math.random() * 900000)}`,
          aggregateType: 'Seat',
          aggregateId: seatNumber,
          eventType: 'SeatReleasedEvent',
          payload: JSON.stringify({ bookingId: currentBooking?.id, seatNumber, status: 'AVAILABLE' }),
          status: 'PENDING',
          createdAt: new Date().toISOString(),
          correlationId: currentCorrelationId,
        };
        setSeatOutbox(prev => [...prev, seatOutboxMsg]);

        addTraceLog(
          'Seat Service',
          'INFO',
          `Seat unlocked inside DB successfully. Event written in outbox.`,
          undefined,
          dbTxSpan
        );

        setTimeout(() => {
          setSeatOutbox(prev => prev.map(m => m.id === seatOutboxMsg.id ? { ...m, status: 'PUBLISHED', processedAt: new Date().toISOString() } : m));
          setActiveExchange('seat.exchange');

          addTraceLog(
            'Seat Service',
            'INFO',
            `Outbox Publisher: Published SeatReleasedEvent to 'seat.exchange'`,
            undefined
          );

          addTraceLog(
            'RabbitMQ',
            'INFO',
            `Routing reply to Saga Orchestrator inbox queue 'booking.commands'.`,
            `Payload: ${seatOutboxMsg.payload}`
          );

          const qMsg: QueueMessage = {
            id: `msg-${Date.now()}`,
            exchange: 'seat.exchange',
            routingKey: 'booking.saga.seat_released',
            queue: 'booking.commands',
            correlationId: currentCorrelationId,
            payload: seatOutboxMsg.payload,
            status: 'QUEUED',
            retryCount: 0,
          };
          setQueueMessages(prev => [...prev, qMsg]);
          setActiveQueue('booking.commands');
        }, 600);

        setSimulationStep(24);
        break;
      }

      // ==========================================
      // STEP 24: SAGA ENCOUNTERS FAILURE FINAL (Full multi-compensation Completed)
      // ==========================================
      case 24: {
        setActiveExchange(null);
        setActiveQueue(null);
        setQueueMessages(prev => prev.map(m => m.queue === 'booking.commands' ? { ...m, status: 'PROCESSED' } : m));

        addTraceLog(
          'Saga Orchestrator',
          'WARN',
          `Saga Orchestrator consumed 'SeatReleasedEvent'. Compensation sequence finished. Transaction rolled back securely. Booking marked as FAILED/REJECTED.`,
          undefined
        );

        setSagaState(prev => {
          if (!prev) return null;
          return {
            ...prev,
            currentState: 'FAILED',
            lastUpdated: new Date().toISOString()
          };
        });

        setCurrentBooking(prev => {
          if (!prev) return null;
          return { ...prev, status: 'FAILED' };
        });
        setBookingDbTable(prev => prev.map(b => b.id === currentBooking?.id ? { ...b, status: 'FAILED' } : b));

        setMetrics(prev => ({
          ...prev,
          activeSagas: Math.max(0, prev.activeSagas - 1),
          failureCount: prev.failureCount + 1,
          compensationCount: prev.compensationCount + 2
        }));

        setIsSimulating(false);
        break;
      }

      default:
        break;
    }
  };

  // Manual Trigger to resolve notification failure (demonstrates poisoned queues processing)
  const handleResolveDLQ = () => {
    if (metrics.dlqCount === 0) return;
    
    addTraceLog(
      'Notification Service',
      'INFO',
      `Manual DLQ Re-queue triggered. Retrying email transmission with active SMTPServer fallback client connection.`,
      `Pulling message from 'notification.dlq' to retry...`
    );

    setTimeout(() => {
      // Set email to SENT in Db logs
      setNotificationDbTable(prev => prev.map(n => n.to === 'user@gmail.com' ? { ...n, status: 'SENT', retries: n.retries + 1 } : n));
      
      addTraceLog(
        'Notification Service',
        'INFO',
        `Email successfully delivered using secondary failover gateway SMTP server SMTP2GO. Dispatch log index finalized.`,
        `Confirmation dispatch completed.`
      );

      // Settle queues
      setQueueMessages(prev => prev.map(m => m.queue === 'notification.dlq' ? { ...m, status: 'PROCESSED' } : m));
      setMetrics(prev => ({
        ...prev,
        dlqCount: Math.max(0, prev.dlqCount - 1),
        successCount: prev.successCount + 1
      }));
    }, 1000);
  };

  return (
    <div className="space-y-6 text-[#E0E0E0]" id="interactive-simulator">
      {/* Simulation Controls Card */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 bg-[#0c0c14] border border-[#1a1a2e] rounded-xl p-6 shadow-sm flex flex-col justify-between" id="sim-controls-card">
          <div>
            <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2 uppercase tracking-wider">
              <Activity className="h-4.5 w-4.5 text-[#00b4ff]" />
              Saga Transaction Parameters
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#666] uppercase tracking-wider mb-2">Customer Name</label>
                <input 
                  type="text" 
                  value={customerName} 
                  onChange={(e) => setCustomerName(e.target.value)}
                  disabled={isSimulating}
                  className="w-full text-xs py-2 px-3 bg-[#020204] border border-[#1a1a2e] rounded text-[#E0E0E0] focus:outline-none focus:border-[#00b4ff] disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[#666] uppercase tracking-wider mb-2">Seat Allocation</label>
                  <select 
                    value={seatNumber}
                    onChange={(e) => setSeatNumber(e.target.value)}
                    disabled={isSimulating}
                    className="w-full text-xs py-2 px-3 bg-[#020204] border border-[#1a1a2e] rounded text-[#E0E0E0] focus:outline-none focus:border-[#00b4ff]"
                  >
                    <option value="12A">Seat 12A ($157.50)</option>
                    <option value="14F">Seat 14F ($157.50)</option>
                    <option value="22B">Seat 22B ($157.50)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#666] uppercase tracking-wider mb-2">Transaction Value</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs text-[#444]">$</span>
                    <input 
                      type="number" 
                      value={price} 
                      disabled
                      className="w-full text-xs py-2 pl-6 pr-3 bg-[#050508] border border-[#1a1a2e] rounded text-[#666] cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#666] uppercase tracking-wider mb-2">Simulation Scenario Path</label>
                <div className="space-y-2">
                  {[
                    { id: 'success', label: 'Option A: Orchestrated Success Path', desc: 'No errors, happy flow' },
                    { id: 'payment_fail', label: 'Option B: Payment Authorization Fails', desc: 'Triggers compensation: Release Seat' },
                    { id: 'ticket_fail', label: 'Option C: Ticket PDF Generation Fails', desc: 'Triggers compensation: Refund, Release Seat' },
                    { id: 'email_fail', label: 'Option D: Email Timeout (DLQ routing)', desc: 'Booking completes, Notification triggers re-queue/DLQ' }
                  ].map((scen) => (
                    <label 
                      key={scen.id} 
                      className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-all ${
                        scenarioMode === scen.id 
                          ? 'border-[#00b4ff] bg-[#00b4ff]/5' 
                          : 'border-[#1a1a2e] hover:bg-[#12121e]/40'
                      }`}
                    >
                      <input 
                        type="radio" 
                        name="scenario" 
                        value={scen.id}
                        checked={scenarioMode === scen.id}
                        onChange={() => setScenarioMode(scen.id as any)}
                        disabled={isSimulating}
                        className="mt-1 text-[#00b4ff] focus:ring-0 focus:ring-offset-0 accent-[#00b4ff]"
                      />
                      <div>
                        <span className="block text-xs font-bold text-white">{scen.label}</span>
                        <span className="block text-[10px] text-[#888] mt-0.5">{scen.desc}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex gap-3">
            <button 
              onClick={startSimulation}
              disabled={isSimulating}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-[#0047ff] to-[#00b4ff] hover:brightness-110 disabled:from-[#1a1a2e] disabled:to-[#1a1a2e] disabled:text-[#444] disabled:cursor-not-allowed text-white text-xs font-bold py-3 px-4 rounded shadow-sm transition-all focus:outline-none"
            >
              <Play className="h-3.5 w-3.5" />
              {isSimulating ? 'Saga Processing...' : 'Trigger Distributed Saga'}
            </button>
            <button 
              onClick={handleReset}
              className="px-3 border border-[#1a1a2e] rounded hover:bg-[#12121e] text-[#666] hover:text-white transition-all focus:outline-none"
              title="Reset Simulator"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Live Metrics Grid */}
        <div className="lg:col-span-2 space-y-6 flex flex-col justify-between" id="sim-metrics-columns">
          {/* Top KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4" id="metrics-card-grid">
            {[
              { id: 'm1', label: 'Active Saga Workflows', value: metrics.activeSagas, icon: Zap, color: 'text-[#ffbf00] bg-[#ffbf00]/10 border border-[#ffbf00]/20' },
              { id: 'm2', label: 'Sagas Completed (Success)', value: metrics.successCount, icon: CheckCircle2, color: 'text-[#00ff64] bg-[#00ff64]/10 border border-[#00ff64]/20' },
              { id: 'm3', label: 'Sagas Terminated (Failure)', value: metrics.failureCount, icon: AlertTriangle, color: 'text-[#ff4444] bg-[#ff4444]/10 border border-[#ff4444]/20' },
              { id: 'm4', label: 'Compensations Executed', value: metrics.compensationCount, icon: RotateCcw, color: 'text-orange-500 bg-orange-500/10 border border-orange-500/20' },
              { id: 'm5', label: 'Transient Retry Attempts', value: metrics.retryCount, icon: RefreshCw, color: 'text-[#00b4ff] bg-[#00b4ff]/10 border border-[#00b4ff]/20' },
              { id: 'm6', label: 'Poison Messages (DLQ Count)', value: metrics.dlqCount, icon: Layers, color: 'text-red-400 bg-red-400/10 border border-red-400/20', dlqAlert: true },
            ].map((met) => (
              <div key={met.id} className="bg-[#0c0c14] border border-[#1a1a2e] rounded-xl p-4 shadow-sm flex items-center justify-between">
                <div>
                  <span className="block text-[9px] uppercase font-bold tracking-wider text-[#666] mb-1">{met.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-mono font-bold text-white">{met.value}</span>
                    {met.dlqAlert && met.value > 0 && (
                      <button 
                        onClick={handleResolveDLQ}
                        className="text-[8px] bg-red-500/10 text-red-500 border border-red-500/35 font-bold px-1.5 py-0.5 rounded hover:bg-red-500 hover:text-white transition-all focus:outline-none animate-pulse"
                      >
                        Purge & Redeliver
                      </button>
                    )}
                  </div>
                </div>
                <div className={`p-2 rounded ${met.color}`}>
                  <met.icon className="h-4.5 w-4.5" />
                </div>
              </div>
            ))}
          </div>

          {/* Interactive Topology Graph */}
          <div className="bg-[#0c0c14] border border-[#1a1a2e] rounded-xl p-6 shadow-sm flex-1 mt-4" id="sim-topology-view">
            <h4 className="text-[10px] uppercase font-bold text-[#666] tracking-wider mb-4 flex items-center justify-between">
              <span>Orchestrated Saga Live Topology</span>
              {isSimulating && (
                <span className="flex items-center gap-1.5 text-xs text-[#00b4ff] font-medium animate-pulse">
                  <span className="h-1.5 w-1.5 bg-[#00b4ff] rounded-full"></span>
                  Processing Transaction Span...
                </span>
              )}
            </h4>

            {/* Nodes Row */}
            <div className="grid grid-cols-5 gap-2 relative py-4" id="sim-topology-grid">
              {/* Connector lines behind */}
              <div className="absolute top-1/2 left-[10%] right-[10%] h-[1px] bg-[#1a1a2e] transform -translate-y-1/2 z-0" />
              
              {/* Service Nodes */}
              {[
                { 
                  name: 'Booking Service', 
                  stateKey: 'START', 
                  activeSteps: [0, 2, 4, 6, 8, 10, 12, 20, 22, 24],
                  status: simulationStep === 0 || simulationStep === 2 || simulationStep === 4 || simulationStep === 6 || simulationStep === 8 ? 'success' : (simulationStep === 10 || simulationStep === 12 || simulationStep === 20 || simulationStep === 22 || simulationStep === 24 ? 'compensating' : 'idle'),
                  icon: Server,
                  db: 'BookingDB'
                },
                { 
                  name: 'Seat Service', 
                  stateKey: 'SEAT_RESERVING', 
                  activeSteps: [1, 11, 23],
                  status: simulationStep === 1 ? 'success' : (simulationStep === 11 || simulationStep === 23 ? 'compensating' : (sagaState?.seatReserved ? 'success' : 'idle')),
                  icon: Layers,
                  db: 'SeatDB'
                },
                { 
                  name: 'Payment Service', 
                  stateKey: 'PAYMENT_AUTHORIZING', 
                  activeSteps: [3, 21],
                  status: simulationStep === 3 ? (scenarioMode === 'payment_fail' ? 'failed' : 'success') : (simulationStep === 21 ? 'compensating' : (sagaState?.paymentAuthorized ? (sagaState?.currentState === 'COMPENSATING_SEAT' || sagaState?.currentState === 'FAILED' ? 'compensated' : 'success') : 'idle')),
                  icon: Database,
                  db: 'PaymentDB'
                },
                { 
                  name: 'Ticket Service', 
                  stateKey: 'TICKET_ISSUING', 
                  activeSteps: [5],
                  status: simulationStep === 5 ? (scenarioMode === 'ticket_fail' ? 'failed' : 'success') : (sagaState?.ticketIssued ? 'success' : 'idle'),
                  icon: Mail,
                  db: 'TicketDB'
                },
                { 
                  name: 'Notification Service', 
                  stateKey: 'EMAIL_SENDING', 
                  activeSteps: [7],
                  status: simulationStep === 7 ? (scenarioMode === 'email_fail' ? 'warning' : 'success') : (sagaState?.emailSent ? 'success' : 'idle'),
                  icon: MessageSquare,
                  db: 'NotificationDB'
                },
              ].map((svc, idx) => {
                const isActive = svc.activeSteps.includes(simulationStep);
                let outlineColor = 'border-[#1a1a2e]';
                let bgColor = 'bg-[#020204] text-[#444]';
                let indicatorColor = 'bg-[#1a1a2e]';
                let statusLabel = 'Idle';

                if (isActive) {
                  outlineColor = 'border-[#00b4ff] bg-[#00b4ff]/5 ring-4 ring-[#00b4ff]/10';
                  bgColor = 'bg-[#00b4ff] text-white';
                  indicatorColor = 'bg-[#00b4ff] animate-ping';
                  statusLabel = 'Processing';
                } else if (svc.status === 'success') {
                  outlineColor = 'border-[#00ff64] bg-[#00ff64]/5';
                  bgColor = 'bg-[#00ff64] text-black';
                  indicatorColor = 'bg-[#00ff64]';
                  statusLabel = 'Completed';
                } else if (svc.status === 'failed') {
                  outlineColor = 'border-[#ff4444] bg-[#ff4444]/5';
                  bgColor = 'bg-[#ff4444] text-white';
                  indicatorColor = 'bg-[#ff4444]';
                  statusLabel = 'Fatal Fail';
                } else if (svc.status === 'warning') {
                  outlineColor = 'border-[#ffbf00] bg-[#ffbf00]/5';
                  bgColor = 'bg-[#ffbf00] text-black';
                  indicatorColor = 'bg-[#ffbf00] animate-pulse';
                  statusLabel = 'Poisoned Mail';
                } else if (svc.status === 'compensating') {
                  outlineColor = 'border-orange-500 bg-orange-500/5';
                  bgColor = 'bg-orange-500 text-white';
                  indicatorColor = 'bg-orange-500 animate-spin';
                  statusLabel = 'Compensating';
                } else if (svc.status === 'compensated') {
                  outlineColor = 'border-orange-500 bg-orange-500/5';
                  bgColor = 'bg-orange-950 text-orange-400';
                  indicatorColor = 'bg-orange-400';
                  statusLabel = 'Refunded';
                }

                return (
                  <div key={svc.name} className="flex flex-col items-center z-10">
                    <div className={`p-4 rounded border ${outlineColor} transition-all duration-300 w-14 h-14 flex items-center justify-center relative bg-[#020204]`}>
                      <span className={`absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full ${indicatorColor} flex items-center justify-center border border-[#020204]`} />
                      <svc.icon className={`h-5 w-5 ${isActive ? 'text-[#00b4ff]' : 'text-[#444]'}`} />
                    </div>
                    <span className="block text-[9px] font-bold text-[#E0E0E0] mt-2 text-center truncate w-full">{svc.name}</span>
                    <span className="block text-[8px] font-semibold text-[#666] mt-0.5 text-center">{statusLabel}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Database Tables & Outbox View Selector */}
      <div className="bg-[#0c0c14] border border-[#1a1a2e] rounded-xl shadow-sm overflow-hidden" id="database-outboxes-section">
        <div className="border-b border-[#1a1a2e] px-6 py-4 bg-[#050508]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">Atomic Database & Transactional Outbox States</h3>
              <p className="text-[10px] text-[#666] mt-0.5">Observe dual-writes committing atomically inside PostgreSQL DB constraints per microservice.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 bg-[#00ff64] rounded-full animate-pulse"></span>
              <span className="text-[9px] uppercase font-mono text-[#00ff64] tracking-widest">Poller Worker: Idle (Listening)</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 divide-y md:divide-y-0 md:divide-x divide-[#1a1a2e]" id="db-outbox-rows">
          {/* Booking Database Column */}
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase">
              <Database className="h-3.5 w-3.5 text-[#00b4ff]" />
              <span>BookingDB</span>
            </div>
            
            {/* Entity Block */}
            <div className="space-y-2">
              <span className="block text-[8px] uppercase font-bold text-[#444] tracking-wider">Table: Booking</span>
              {currentBooking ? (
                <div className="p-2 border border-[#1a1a2e] bg-[#020204] rounded text-[10px] space-y-1 font-mono text-[#E0E0E0]">
                  <div className="flex justify-between"><span>ID:</span> <span className="font-bold text-white">{currentBooking.id}</span></div>
                  <div className="flex justify-between"><span>Seat:</span> <span className="font-bold text-white">{currentBooking.seatNumber}</span></div>
                  <div className="flex justify-between">
                    <span>Status:</span> 
                    <span className={`font-bold px-1 rounded ${
                      currentBooking.status === 'CONFIRMED' ? 'bg-[#00ff64]/10 text-[#00ff64]' :
                      currentBooking.status === 'PENDING' ? 'bg-[#ffbf00]/10 text-[#ffbf00] animate-pulse' :
                      'bg-[#ff4444]/10 text-[#ff4444]'
                    }`}>{currentBooking.status}</span>
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-[#444] text-center py-2 italic font-mono">No active booking aggregates</div>
              )}
            </div>

            {/* Outbox Block */}
            <div className="space-y-2">
              <span className="block text-[8px] uppercase font-bold text-[#444] tracking-wider">Table: Outbox</span>
              {bookingOutbox.map((msg) => (
                <div key={msg.id} className="p-2 border border-[#1a1a2e] bg-[#020204] rounded text-[9px] space-y-1 font-mono relative text-[#E0E0E0]">
                  <div className="truncate font-bold text-white">{msg.eventType}</div>
                  <div className="text-[8px] text-[#666] truncate">UUID: {msg.id.substr(0, 10)}</div>
                  <div className="flex justify-between mt-1 pt-1 border-t border-[#1a1a2e]">
                    <span>State:</span>
                    <span className={`font-bold ${msg.status === 'PUBLISHED' ? 'text-[#00ff64]' : 'text-[#ffbf00] animate-pulse'}`}>{msg.status}</span>
                  </div>
                </div>
              ))}
              {bookingOutbox.length === 0 && <span className="block text-[10px] text-[#444] text-center py-2 italic font-mono">Outbox empty</span>}
            </div>
          </div>

          {/* Seat Database Column */}
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase">
              <Database className="h-3.5 w-3.5 text-[#00b4ff]" />
              <span>SeatDB</span>
            </div>
            
            <div className="space-y-2">
              <span className="block text-[8px] uppercase font-bold text-[#444] tracking-wider">Table: Seat Inventory</span>
              <div className="space-y-1">
                {seatDbTable.map((st) => (
                  <div key={st.id} className="p-1 px-2 border border-[#1a1a2e] bg-[#020204] rounded text-[9px] flex justify-between font-mono text-[#E0E0E0]">
                    <span className="font-bold text-[#999]">Seat {st.seatNumber}</span>
                    <span className={st.status === 'RESERVED' ? 'text-[#ffbf00]' : 'text-[#00ff64]'}>{st.status}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-[8px] uppercase font-bold text-[#444] tracking-wider">Table: Outbox</span>
              {seatOutbox.map((msg) => (
                <div key={msg.id} className="p-2 border border-[#1a1a2e] bg-[#020204] rounded text-[9px] space-y-1 font-mono text-[#E0E0E0]">
                  <div className="truncate font-bold text-white">{msg.eventType}</div>
                  <div className="flex justify-between mt-1 pt-1 border-t border-[#1a1a2e]">
                    <span>State:</span>
                    <span className={`font-bold ${msg.status === 'PUBLISHED' ? 'text-[#00ff64]' : 'text-[#ffbf00] animate-pulse'}`}>{msg.status}</span>
                  </div>
                </div>
              ))}
              {seatOutbox.length === 0 && <span className="block text-[10px] text-[#444] text-center py-2 italic font-mono">Outbox empty</span>}
            </div>
          </div>

          {/* Payment Database Column */}
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase">
              <Database className="h-3.5 w-3.5 text-[#00b4ff]" />
              <span>PaymentDB</span>
            </div>
            
            <div className="space-y-2">
              <span className="block text-[8px] uppercase font-bold text-[#444] tracking-wider">Table: Transactions</span>
              {paymentDbTable.length > 0 ? (
                paymentDbTable.map(p => (
                  <div key={p.id} className="p-2 border border-[#1a1a2e] bg-[#020204] rounded text-[9px] space-y-1 font-mono text-[#E0E0E0]">
                    <div className="flex justify-between"><span>ID:</span> <span className="font-bold text-white">{p.id}</span></div>
                    <div className="flex justify-between"><span>Sum:</span> <span className="font-bold text-white">${p.amount.toFixed(2)}</span></div>
                    <div className="flex justify-between">
                      <span>Gateway:</span>
                      <span className={`font-bold ${
                        p.status === 'AUTHORIZED' ? 'text-[#00ff64]' :
                        p.status === 'REFUNDED' ? 'text-orange-400' :
                        'text-[#ff4444]'
                      }`}>{p.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-[#444] text-center py-2 italic font-mono">Payment ledger empty</div>
              )}
            </div>

            <div className="space-y-2">
              <span className="block text-[8px] uppercase font-bold text-[#444] tracking-wider">Table: Outbox</span>
              {paymentOutbox.map((msg) => (
                <div key={msg.id} className="p-2 border border-[#1a1a2e] bg-[#020204] rounded text-[9px] space-y-1 font-mono text-[#E0E0E0]">
                  <div className="truncate font-bold text-white">{msg.eventType}</div>
                  <div className="flex justify-between mt-1 pt-1 border-t border-[#1a1a2e]">
                    <span>State:</span>
                    <span className={`font-bold ${msg.status === 'PUBLISHED' ? 'text-[#00ff64]' : 'text-[#ffbf00]'}`}>{msg.status}</span>
                  </div>
                </div>
              ))}
              {paymentOutbox.length === 0 && <span className="block text-[10px] text-[#444] text-center py-2 italic font-mono">Outbox empty</span>}
            </div>
          </div>

          {/* Ticket Database Column */}
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase">
              <Database className="h-3.5 w-3.5 text-[#00b4ff]" />
              <span>TicketDB</span>
            </div>
            
            <div className="space-y-2">
              <span className="block text-[8px] uppercase font-bold text-[#444] tracking-wider">Table: IssuedTickets</span>
              {ticketDbTable.length > 0 ? (
                ticketDbTable.map(t => (
                  <div key={t.id} className="p-2 border border-[#1a1a2e] bg-[#020204] rounded text-[9px] space-y-1 font-mono text-[#E0E0E0]">
                    <div className="flex justify-between"><span>ID:</span> <span className="font-bold text-white">{t.id}</span></div>
                    <div className="flex justify-between"><span>Seat:</span> <span className="font-bold text-white">{t.seatNumber}</span></div>
                    <div className="flex justify-between"><span>State:</span> <span className="text-[#00ff64] font-bold">{t.status}</span></div>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-[#444] text-center py-2 italic font-mono">No tickets generated</div>
              )}
            </div>

            <div className="space-y-2">
              <span className="block text-[8px] uppercase font-bold text-[#444] tracking-wider">Table: Outbox</span>
              {ticketOutbox.map((msg) => (
                <div key={msg.id} className="p-2 border border-[#1a1a2e] bg-[#020204] rounded text-[9px] space-y-1 font-mono text-[#E0E0E0]">
                  <div className="truncate font-bold text-white">{msg.eventType}</div>
                  <div className="flex justify-between mt-1 pt-1 border-t border-[#1a1a2e]">
                    <span>State:</span>
                    <span className={`font-bold ${msg.status === 'PUBLISHED' ? 'text-[#00ff64]' : 'text-[#ffbf00]'}`}>{msg.status}</span>
                  </div>
                </div>
              ))}
              {ticketOutbox.length === 0 && <span className="block text-[10px] text-[#444] text-center py-2 italic font-mono">Outbox empty</span>}
            </div>
          </div>

          {/* Notification Database Column */}
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase">
              <Database className="h-3.5 w-3.5 text-[#00b4ff]" />
              <span>NotificationDB</span>
            </div>
            
            <div className="space-y-2">
              <span className="block text-[8px] uppercase font-bold text-[#444] tracking-wider">Table: EmailLogs</span>
              {notificationDbTable.length > 0 ? (
                notificationDbTable.map(n => (
                  <div key={n.id} className="p-2 border border-[#1a1a2e] bg-[#020204] rounded text-[9px] space-y-1 font-mono text-[#E0E0E0]">
                    <div className="truncate"><span>To:</span> <span className="font-bold text-white">{n.to}</span></div>
                    <div className="flex justify-between">
                      <span>Status:</span>
                      <span className={`font-bold px-1 rounded ${
                        n.status === 'SENT' ? 'bg-[#00ff64]/10 text-[#00ff64]' : 'bg-[#ff4444]/10 text-[#ff4444] animate-pulse'
                      }`}>{n.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-[10px] text-[#444] text-center py-2 italic font-mono">No dispatch activity logs</div>
              )}
            </div>

            <div className="space-y-2">
              <span className="block text-[8px] uppercase font-bold text-[#444] tracking-wider">Table: Outbox</span>
              {notificationOutbox.map((msg) => (
                <div key={msg.id} className="p-2 border border-[#1a1a2e] bg-[#020204] rounded text-[9px] space-y-1 font-mono text-[#E0E0E0]">
                  <div className="truncate font-bold text-white">{msg.eventType}</div>
                  <div className="flex justify-between mt-1 pt-1 border-t border-[#1a1a2e]">
                    <span>State:</span>
                    <span className={`font-bold ${msg.status === 'PUBLISHED' ? 'text-[#00ff64]' : 'text-[#ffbf00]'}`}>{msg.status}</span>
                  </div>
                </div>
              ))}
              {notificationOutbox.length === 0 && <span className="block text-[10px] text-[#444] text-center py-2 italic font-mono">Outbox empty</span>}
            </div>
          </div>
        </div>
      </div>

      {/* RabbitMQ Messaging Architecture Diagram & Live Broker Monitor */}
      <div className="bg-[#050508] text-white rounded-xl shadow-md border border-[#1a1a2e] overflow-hidden" id="rabbitmq-broker-panel">
        <div className="border-b border-[#1a1a2e] px-6 py-4 bg-[#050508]">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <Layers className="h-4 w-4 text-[#00ff64]" />
                RabbitMQ Enterprise Message Broker (Live Queue Viewer)
              </h3>
              <p className="text-[10px] text-[#666] mt-0.5 font-sans">Real-time state transitions of routing keys, AMQP exchanges, active queues, and DLQ segments.</p>
            </div>
            <span className="text-[9px] font-mono px-2.5 py-1 rounded bg-[#00ff64]/10 border border-[#00ff64]/20 text-[#00ff64] font-bold">NODE AMQP LIVE</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 divide-y lg:divide-y-0 lg:divide-x divide-[#1a1a2e]" id="broker-columns">
          {/* Active Routing Column */}
          <div className="lg:col-span-1 p-5 space-y-4">
            <h4 className="text-[10px] font-bold text-[#666] uppercase tracking-wider">Exchange Routing Map</h4>
            <div className="space-y-2.5" id="routing-rules">
              {[
                { label: 'Booking Exchange', ex: 'booking.exchange', active: activeExchange === 'booking.exchange' },
                { label: 'Seat Exchange', ex: 'seat.exchange', active: activeExchange === 'seat.exchange' },
                { label: 'Payment Exchange', ex: 'payment.exchange', active: activeExchange === 'payment.exchange' },
                { label: 'Ticket Exchange', ex: 'ticket.exchange', active: activeExchange === 'ticket.exchange' },
                { label: 'Notification Ex', ex: 'notification.exchange', active: activeExchange === 'notification.exchange' },
              ].map((item) => (
                <div key={item.ex} className={`p-2.5 rounded border text-xs font-mono flex justify-between items-center transition-all duration-300 ${
                  item.active 
                    ? 'bg-[#00ff64]/5 border-[#00ff64] text-[#00ff64] shadow-sm' 
                    : 'bg-[#020204] border-[#1a1a2e] text-[#444]'
                }`}>
                  <span>{item.ex}</span>
                  {item.active && <ArrowRight className="h-3.5 w-3.5 animate-pulse" />}
                </div>
              ))}
            </div>
          </div>

          {/* Active Queues Engine */}
          <div className="lg:col-span-3 p-5" id="active-queues-engine">
            <h4 className="text-[10px] font-bold text-[#666] uppercase tracking-wider mb-4">Core AMQP Queues</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" id="amqp-queues-grid">
              {[
                { name: 'booking.commands', routingKey: 'booking.saga.*', desc: 'Consumes reply events to control orchestration loop.', color: 'text-[#00b4ff]' },
                { name: 'seat.commands', routingKey: 'seat.*', desc: 'Controls reserve and compensation releases.', color: 'text-[#00b4ff]' },
                { name: 'payment.commands', routingKey: 'payment.*', desc: 'Snares authorized, captures, and refunds commands.', color: 'text-[#00b4ff]' },
                { name: 'ticket.commands', routingKey: 'ticket.*', desc: 'Generates final and backup boarding assets.', color: 'text-[#00b4ff]' },
                { name: 'notification.commands', routingKey: 'notification.*', desc: 'Triggers outgoing transactional customer emails.', color: 'text-violet-400' },
                { name: 'notification.dlq', routingKey: 'notification.dlq', desc: 'Handles corrupted or repeatedly failing notifications.', color: 'text-[#ff4444]', isDlq: true },
              ].map((q) => {
                const activeMsgs = queueMessages.filter(m => m.queue === q.name && m.status === 'QUEUED');
                const lastProcessed = queueMessages.filter(m => m.queue === q.name && m.status === 'PROCESSED').slice(-1)[0];
                const isQActive = activeQueue === q.name || activeMsgs.length > 0;
                
                return (
                  <div key={q.name} className={`p-4 rounded border transition-all duration-300 flex flex-col justify-between ${
                    isQActive 
                      ? (q.isDlq ? 'bg-red-500/10 border-[#ff4444]/55' : 'bg-[#00b4ff]/5 border-[#00b4ff]/50') 
                      : 'bg-[#020204] border-[#1a1a2e]'
                  }`}>
                    <div>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`text-xs font-bold font-mono ${q.color}`}>{q.name}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded font-mono font-bold ${
                          activeMsgs.length > 0 ? 'bg-[#00b4ff] text-white animate-pulse' : 'bg-[#020204] text-[#444] border border-[#1a1a2e]'
                        }`}>
                          {activeMsgs.length} Msg
                        </span>
                      </div>
                      <span className="block text-[9px] text-[#666] font-mono mt-1">Routing: {q.routingKey}</span>
                      <p className="text-[10px] text-[#999] mt-2 leading-relaxed font-sans">{q.desc}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#1a1a2e] flex items-center justify-between text-[9px] font-mono">
                      <span className="text-[#444]">Status:</span>
                      {activeMsgs.length > 0 ? (
                        <span className="text-[#ffbf00] animate-pulse font-bold">DELIVERING</span>
                      ) : lastProcessed ? (
                        <span className="text-[#00ff64] font-bold">ACKNOWLEDGED</span>
                      ) : q.isDlq && metrics.dlqCount > 0 ? (
                        <span className="text-[#ff4444] animate-pulse font-bold flex items-center gap-1">
                          <AlertTriangle className="h-2.5 w-2.5" /> POISON DETECTED
                        </span>
                      ) : (
                        <span className="text-[#444]">IDLE</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* OpenTelemetry Logs & Distributed Tracing Panel */}
      <div className="bg-[#050508] border border-[#1a1a2e] rounded-xl overflow-hidden shadow-lg flex flex-col" id="opentelemetry-tracer">
        <div className="border-b border-[#1a1a2e] px-6 py-4 bg-[#050508] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#00b4ff]" />
              OpenTelemetry Jaeger Trace Log Terminal
            </h3>
            <p className="text-[10px] text-[#666] mt-0.5">Distributed context propagation capturing Correlation IDs, Span hierarchies, and execution timelines.</p>
          </div>
          <span className="text-[9px] font-mono text-[#555] uppercase tracking-wider font-bold">Context: W3C Trace Schema</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-[#1a1a2e]" id="tracer-grid">
          {/* Logs View Console */}
          <div className="lg:col-span-2 p-4 h-[350px] overflow-y-auto flex flex-col-reverse divide-y divide-[#0c0c14] bg-[#020204] font-mono text-[11px]" id="logs-console">
            {logs.length > 0 ? (
              logs.map((log) => {
                let badgeColor = 'bg-[#1a1a2e] text-[#999]';
                if (log.level === 'WARN') badgeColor = 'bg-[#ffbf00]/10 text-[#ffbf00] border border-[#ffbf00]/20';
                if (log.level === 'ERROR') badgeColor = 'bg-[#ff4444]/10 text-[#ff4444] border border-[#ff4444]/20';

                const isSelected = selectedSpan?.id === log.id;

                return (
                  <div 
                    key={log.id} 
                    onClick={() => setSelectedSpan(log)}
                    className={`py-3 px-2 flex items-start gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-[#12121e] text-white border-l-2 border-[#00b4ff]' : 'hover:bg-[#0c0c14] text-[#999]'
                    }`}
                  >
                    <span className="text-[10px] text-[#444] shrink-0 select-none">
                      {log.timestamp.substr(11, 8)}
                    </span>
                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold tracking-wider shrink-0 uppercase select-none ${badgeColor}`}>
                      {log.level}
                    </span>
                    <div className="flex-1 space-y-1">
                      <div className="flex justify-between flex-wrap gap-2">
                        <span className="font-bold text-white">{log.serviceName}</span>
                        <span className="text-[9px] text-[#444]">Span: {log.spanId}</span>
                      </div>
                      <p className="text-[#888] leading-relaxed text-[11px]">{log.message}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[#444] gap-2 font-mono text-xs">
                <Layers className="h-8 w-8 animate-pulse text-[#1a1a2e]" />
                <span className="italic">No trace captures registered. Tap "Trigger Distributed Saga" to begin execution flow.</span>
              </div>
            )}
          </div>

          {/* Span Details Inspector */}
          <div className="lg:col-span-1 p-5 space-y-4 bg-[#050508]" id="tracer-details-sidebar">
            <h4 className="text-[10px] font-bold text-white uppercase tracking-wider">Span Schema Inspector</h4>
            
            {selectedSpan ? (
              <div className="space-y-4 font-mono text-[10px] leading-relaxed" id="span-attributes-view">
                <div>
                  <span className="block text-[8px] uppercase font-bold text-[#666] tracking-wider">Timestamp</span>
                  <span className="block text-[#E0E0E0] bg-[#020204] p-2 rounded mt-1 border border-[#1a1a2e]">{selectedSpan.timestamp}</span>
                </div>
                <div>
                  <span className="block text-[8px] uppercase font-bold text-[#666] tracking-wider">W3C Metadata</span>
                  <div className="bg-[#020204] p-2.5 rounded mt-1 space-y-1 text-[#E0E0E0] border border-[#1a1a2e]">
                    <div><span className="text-[#555]">trace_id:</span> {selectedSpan.correlationId}</div>
                    <div><span className="text-[#555]">span_id :</span> {selectedSpan.spanId}</div>
                    {selectedSpan.parentSpanId && <div><span className="text-[#555]">parent  :</span> {selectedSpan.parentSpanId}</div>}
                  </div>
                </div>
                <div>
                  <span className="block text-[8px] uppercase font-bold text-[#666] tracking-wider">Resource Attributes</span>
                  <div className="bg-[#020204] p-2.5 rounded mt-1 space-y-1 text-[#999] border border-[#1a1a2e]">
                    <div><span className="text-[#555]">service.name:</span> {selectedSpan.serviceName.toLowerCase().replace(' ', '-')}</div>
                    <div><span className="text-[#555]">telemetry.sdk.language:</span> dotnet</div>
                    <div><span className="text-[#555]">otel.library.name:</span> OpenTelemetry.Instrumentation</div>
                  </div>
                </div>
                {selectedSpan.details && (
                  <div>
                    <span className="block text-[8px] uppercase font-bold text-[#666] tracking-wider">Event Payload Logs</span>
                    <pre className="bg-[#020204] text-[#00ff64] p-2.5 rounded mt-1 overflow-x-auto whitespace-pre-wrap border border-[#1a1a2e]">{selectedSpan.details}</pre>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-[250px] flex flex-col items-center justify-center text-[#444] gap-2 font-mono text-[9.5px]">
                <Activity className="h-5 w-5" />
                <span className="text-center italic">Select any logs from the trace console to inspect rich telemetry span structures.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
