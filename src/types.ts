export interface Booking {
  id: string;
  customerId: string;
  seatNumber: string;
  amount: number;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REJECTED';
  createdAt: string;
}

export interface SagaState {
  sagaId: string;
  bookingId: string;
  customerId: string;
  seatNumber: string;
  amount: number;
  currentState: 'START' | 'SEAT_RESERVING' | 'SEAT_RESERVED' | 'PAYMENT_AUTHORIZING' | 'PAYMENT_AUTHORIZED' | 'TICKET_ISSUING' | 'TICKET_ISSUED' | 'EMAIL_SENDING' | 'COMPLETED' | 'COMPENSATING_TICKET' | 'COMPENSATING_PAYMENT' | 'COMPENSATING_SEAT' | 'COMPENSATING_COMPLETED' | 'FAILED';
  seatReserved: boolean;
  paymentAuthorized: boolean;
  ticketIssued: boolean;
  emailSent: boolean;
  retryCount: number;
  maxRetries: number;
  correlationId: string;
  lastUpdated: string;
}

export interface OutboxEntry {
  id: string;
  aggregateType: 'Booking' | 'Seat' | 'Payment' | 'Ticket' | 'Notification';
  aggregateId: string;
  eventType: string;
  payload: string;
  status: 'PENDING' | 'PUBLISHED' | 'FAILED';
  createdAt: string;
  processedAt?: string;
  correlationId: string;
}

export interface TraceLog {
  id: string;
  timestamp: string;
  serviceName: 'Booking Service' | 'Seat Service' | 'Payment Service' | 'Ticket Service' | 'Notification Service' | 'RabbitMQ' | 'Saga Orchestrator';
  level: 'INFO' | 'WARN' | 'ERROR';
  correlationId: string;
  spanId: string;
  parentSpanId?: string;
  message: string;
  details?: string;
}

export interface QueueMessage {
  id: string;
  exchange: string;
  routingKey: string;
  queue: string;
  correlationId: string;
  payload: string;
  status: 'QUEUED' | 'PROCESSED' | 'FAILED' | 'DLQ' | 'RETRIED';
  retryCount: number;
}
