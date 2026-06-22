# Distributed Booking Platform

> A production-grade distributed booking platform demonstrating modern cloud-native architecture and advanced distributed systems patterns. Built as an enterprise solution showcasing Saga Pattern, Transactional Outbox, Event-Driven Architecture, and microservices best practices.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [System Design](#2-system-design)
3. [Services Breakdown](#3-services-breakdown)
4. [Saga Pattern (The Heart of the System)](#4-saga-pattern)
5. [Transactional Outbox Pattern](#5-transactional-outbox-pattern)
6. [RabbitMQ Messaging Design](#6-rabbitmq-messaging-design)
7. [API Reference](#7-api-reference)
8. [Database Design](#8-database-design)
9. [Observability](#9-observability)
10. [Running Locally](#10-running-locally)
11. [Deployment](#11-deployment)
12. [Failure Scenarios & How They're Handled](#12-failure-scenarios)
13. [Data Consistency & Tradeoffs](#13-data-consistency)
14. [Security](#14-security)
15. [FAQ for Freshers](#15-faq-for-freshers)

---

## 1. Architecture Overview

### High-Level Architecture

```
                    ┌─────────────┐
                    │   Client    │
                    │  (React UI) │
                    └──────┬──────┘
                           │ HTTP
                    ┌──────▼──────┐
                    │   Booking   │  API Gateway / Entry Point
                    │   Service   │
                    └──────┬──────┘
                           │ Orchestrated Saga via Events
         ┌─────────────────┼──────────────────┐
         │                 │                  │
    ┌────▼─────┐    ┌─────▼─────┐    ┌───────▼───┐
    │   Seat    │    │  Payment  │    │   Ticket   │
    │  Service  │    │  Service  │    │  Service   │
    └────┬──────┘    └─────┬─────┘    └───────┬───┘
         │                 │                  │
         └─────────────────┼──────────────────┘
                           │
                    ┌──────▼──────┐
                    │   Notif.    │
                    │   Service   │
                    └─────────────┘

         ═══════════════════════════════════════
         │        RabbitMQ Message Bus         │
         ═══════════════════════════════════════

    ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ BookingDB│ │  SeatDB  │ │PaymentDB │ │ TicketDB │ │ NotifDB  │
    │(Postgres)│ │(Postgres)│ │(Postgres)│ │(Postgres)│ │(Postgres)│
    └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘

    ════════════════════════════════════════════════════════════
    │           Observability Stack                            │
    │  Jaeger (Tracing) │ Prometheus (Metrics) │ Grafana (UI)  │
    ════════════════════════════════════════════════════════════
```

### Key Principles

| Principle | How We Achieve It |
|-----------|-------------------|
| **No Shared Database** | Each service owns its own PostgreSQL database. Services never read each other's DB directly. |
| **Event-Driven Communication** | Services communicate exclusively through RabbitMQ events. No synchronous HTTP calls between services for business logic. |
| **Eventually Consistent** | The system does NOT use distributed transactions (2PC). Instead, we use the Saga pattern to achieve eventual consistency. |
| **Each Service Has Its Own Schema** | Bookings can be in "pending", "seat reserved", "payment authorized" states - other services don't see partial states. |
| **Idempotent Processing** | Every event handler checks if it has already processed an event before acting, preventing duplicate work. |

---

## 2. System Design

### Technology Stack

| Component | Technology | Why |
|-----------|------------|-----|
| Backend Runtime | .NET 10 (ASP.NET Core) | Cross-platform, high performance, modern C# |
| ORM | Entity Framework Core 10 | Mature ORM with PostgreSQL support |
| Database | PostgreSQL 16 | ACID compliant, supports JSON, great concurrency |
| Message Broker | RabbitMQ 4 | Mature, supports DLQs, routing, persistence |
| Tracing | OpenTelemetry + Jaeger | Industry standard for distributed tracing |
| Metrics | Prometheus + Grafana | Standard monitoring stack |
| Containerization | Docker + Kubernetes | Portable deployment |
| API Documentation | Swagger/OpenAPI | Auto-generated API docs at `/swagger` |

### Folder Structure Explained

```
backend/
├── src/
│   ├── BuildingBlocks/
│   │   └── BookingPlatform.Common/        ← Shared code used by ALL services
│   │       ├── Events/                     ← Event definitions (BookingCreated, SeatReserved, etc.)
│   │       ├── Interfaces/                 ← Contracts (IEventBus, IOutboxService, etc.)
│   │       ├── Messaging/                  ← RabbitMQ implementation
│   │       ├── Middleware/                 ← Correlation ID, Exception handling
│   │       ├── Outbox/                     ← Outbox publisher background service
│   │       ├── Idempotency/                ← Duplicate detection
│   │       ├── OpenTelemetry/              ← Tracing/metrics configuration
│   │       ├── HealthChecks/               ← Health check implementations
│   │       ├── Models/                     ← BaseEntity, ValueObject
│   │       └── Behaviors/                  ← MediatR pipeline behaviors
│   │
│   └── Services/
│       ├── BookingService/                 ← The entry point and saga coordinator
│       │   ├── Domain/
│       │   │   ├── Aggregates/             ← Booking (main entity), SagaState
│       │   │   ├── Events/                 ← BookingCreatedDomainEvent, etc.
│       │   │   └── ValueObjects/           ← Money, etc.
│       │   ├── Application/
│       │   │   ├── Commands/               ← CreateBookingCommand
│       │   │   ├── Handlers/               ← CreateBookingHandler
│       │   │   ├── Services/               ← BookingSagaOrchestrator
│       │   │   └── EventHandlers/          ← Handles events from other services
│       │   ├── Infrastructure/
│       │   │   ├── Persistence/            ← DbContext
│       │   │   ├── Outbox/                 ← Outbox service implementation
│       │   │   └── Messaging/              ← Event consumer registrations
│       │   └── Api/
│       │       ├── Controllers/            ← REST endpoints
│       │       └── Models/                 ← Request/Response DTOs
│       │
│       ├── SeatService/                    ← Seat inventory management
│       ├── PaymentService/                 ← Payment authorization & refunds
│       ├── TicketService/                  ← Ticket generation & cancellation
│       └── NotificationService/            ← Email notifications
│
├── docker-compose.yml                     ← 10 containers for local dev
├── kubernetes/                            ← Production K8s manifests
├── helm/                                  ← Helm chart for deployment
├── prometheus/                            ← Prometheus config
├── grafana/                               ← Grafana dashboards
├── rabbitmq/                              ← Pre-configured exchanges/queues
└── opentelemetry/                         ← OTel collector config
```

---

## 3. Services Breakdown

### 3.1 Booking Service (Port 5001)

**Purpose:** The entry point for all booking requests. It owns the Booking aggregate and the Saga Orchestrator that coordinates the entire workflow.

**Owns:**
- `Booking` table - the booking record
- `BookingSagas` table - saga state machine state
- `OutboxMessages` table - transactional outbox

**Responsibilities:**
1. Receive `POST /api/bookings` with seat ID, customer info, amount
2. Create a `Booking` in `Pending` status
3. Save the event `BookingCreated` to the outbox
4. Start the Saga Orchestrator which sends `SeatReservedEvent`
5. Listen for events from other services and advance the saga

**API:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/bookings` | Create a new booking |
| GET | `/api/bookings/{id}` | Get booking status |

### 3.2 Seat Service (Port 5002)

**Purpose:** Manages seat inventory. Prevents double-booking.

**Owns:**
- `Seats` table - available seats
- `SeatReservations` table - active reservations

**Responsibilities:**
1. Reserve a seat when `SeatReservedEvent` is published
2. Release a seat when compensation is needed (via `SeatReleasedEvent`)
3. Never allow double-booking (uses PostgreSQL row-level locking via transaction)

**API:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/seats/reserve` | Reserve a seat |
| POST | `/api/seats/release` | Release a reservation |

### 3.3 Payment Service (Port 5003)

**Purpose:** Handles payment authorization and refunds.

**Owns:**
- `Payments` table - payment transactions

**Responsibilities:**
1. Authorize payment amount
2. Refund payment when compensation is triggered
3. Track payment status (Pending → Authorized → Refunded)

**API:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/payments/authorize` | Authorize a payment |
| POST | `/api/payments/refund` | Refund a payment |

### 3.4 Ticket Service (Port 5004)

**Purpose:** Issues tickets once payment is confirmed.

**Owns:**
- `Tickets` table - issued tickets with unique ticket numbers

**Responsibilities:**
1. Generate a unique ticket number (`TKT-YYYYMMDD-XXXXXX`)
2. Issue the ticket
3. Cancel the ticket if compensation is needed

**API:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/tickets/issue` | Issue a ticket |
| POST | `/api/tickets/cancel` | Cancel a ticket |

### 3.5 Notification Service (Port 5005)

**Purpose:** Sends confirmation emails.

**Owns:**
- `EmailLogs` table - record of all email attempts

**Responsibilities:**
1. Send confirmation email
2. Retry on failure (up to 5 times)
3. If email still fails, the booking remains successful (email is non-critical)

**API:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/notifications/send` | Send an email |

---

## 4. Saga Pattern

### What is a Saga?

A **Saga** is a sequence of local transactions where each transaction publishes an event that triggers the next transaction. If a step fails, the saga runs **compensating transactions** to undo what was done.

**Important:** Sagas do NOT use distributed transactions (2PC). Each step commits to its own database independently. This gives us better performance and availability.

### Why Not 2PC (Two-Phase Commit)?

| 2PC | Saga |
|-----|------|
| All participants must be available | Works even if some services are down |
| Holds database locks for duration | Each step commits immediately |
| Single coordinator = single point of failure | Distributed coordination via events |
| Poor scalability | Each service scales independently |
| Not suitable for microservices | Designed for microservices |

### Our Saga Flow

```
Happy Path (Everything succeeds):
──────────────────────────────────

  Booking → Reserve Seat → Authorize Payment → Issue Ticket → Send Email → Done
  Request      (Step 1)        (Step 2)          (Step 3)      (Step 4)
                   
  Status: Pending → SeatReserved → PaymentAuthorized → TicketIssued → Confirmed


Saga State Machine:

                    ┌──────────┐
                    │  Pending  │
                    └─────┬────┘
                          │ Seat reserved
                    ┌─────▼──────┐
                    │SeatReserved│
                    └─────┬──────┘
                     ┌────┼────┐
                     │    │    │
                ┌────▼┐ ┌▼───▼─┐ ┌──────┐
                │     │ │      │ │      │
           ┌────┤Pay  │ │Pay   │ │Seat  │
           │    │Auth │ │Failed│ │Res   │
           │    │     │ │      │ │Failed│
           │    └─────┘ └──┬───┘ └──┬───┘
           │               │        │
           │         ┌─────▼──┐  ┌──▼──────┐
           │         │Payment │  │  Saga   │
           │         │Auth'd  │  │  Fails  │
           │         └────┬───┘  └─────────┘
           │          ┌───┼───┐
           │          │   │   │
           │     ┌────▼┐ │ ┌─▼─────┐
           │     │     │ │ │       │
           │     │Tckt │ │ │TckFail│
           │     │     │ │ │       │
           │     └──┬──┘ │ └───┬───┘
           │        │    │     │
           │   ┌────▼──┐ │ ┌──▼──────┐
           │   │ Ticket│ │ │Refund   │
           │   │Issued │ │ │+Release │
           │   └───┬───┘ │ └─────────┘
           │       │     │
           │  ┌────▼──┐  │
           │  │Email  │  │
           │  │Sent   │  │
           │  └──┬────┘  │
           │  ┌──▼───┐   │
           │  │Email │   │
           │  │Fail  │   │
           │  │(retry│   │
           │  │ OK)  │   │
           │  └──┬───┘   │
           │  ┌──▼────┐  │
           └──►Confirmed│ │
              └─────────┘ │
                    ┌─────▼──────┐
                    │   Failed   │
                    └────────────┘
```

### Failure Handling Rules

| What Fails | What Happens | Compensation Steps |
|------------|--------------|-------------------|
| **Seat Reservation** | Saga fails immediately | None needed (nothing happened yet) |
| **Payment Authorization** | Release the seat | 1. Publish SeatReleasedEvent |
| **Ticket Issuance** | Refund payment, then release seat | 1. Publish PaymentRefundedEvent → 2. Publish SeatReleasedEvent |
| **Email Sending** | Booking SUCCEEDS, retry email later | No compensation needed. Email is eventually consistent. |

### Compensation Flows

```
Scenario 1: Payment fails after seat is reserved
─────────────────────────────────────────────────
  Reserve Seat ✓ → Payment ✗
                    │
                    ▼
              Release Seat (compensation)
                    │
                    ▼
              Booking Failed

Scenario 2: Ticket fails after payment authorized
──────────────────────────────────────────────────
  Reserve Seat ✓ → Payment ✓ → Ticket ✗
                                │
                                ▼
                          Refund Payment (compensation)
                                │
                                ▼
                          Release Seat (compensation)
                                │
                                ▼
                          Booking Failed

Scenario 3: Email fails after ticket issued
────────────────────────────────────────────
  Reserve Seat ✓ → Payment ✓ → Ticket ✓ → Email ✗
                                            │
                                            ▼
                                    Retry later
                                    Booking CONFIRMED
```

---

## 5. Transactional Outbox Pattern

### The Problem

When a service needs to:
1. Save data to its database
2. Publish an event to RabbitMQ

...if it does these as two separate operations, what happens if:
- The DB save succeeds but publishing fails? → Event is lost forever.
- The publish succeeds but DB save fails? → Other services get an event for data that doesn't exist.

### The Solution: Outbox Pattern

```
                    ┌──────────────────────┐
                    │   Database Transaction │
                    │                       │
                    │  1. INSERT INTO       │
                    │     Bookings (...)     │
                    │  2. INSERT INTO        │
                    │     OutboxMessages     │
                    │     (event payload)    │
                    │                       │
                    │  COMMIT (both or none)│
                    └──────────┬───────────┘
                               │
                    ┌──────────▼───────────┐
                    │  OutboxPublisherService│
                    │  (Background worker)   │
                    │                        │
                    │  Polls every 1 second: │
                    │  SELECT * FROM         │
                    │  OutboxMessages        │
                    │  WHERE Status =        │
                    │  'Pending'             │
                    │                        │
                    │  Publishes to RabbitMQ │
                    │  Marks as 'Processed'  │
                    └────────────────────────┘
```

### Outbox Table Schema

```sql
CREATE TABLE booking.OutboxMessages (
    Id              UUID PRIMARY KEY,
    EventType       VARCHAR(500) NOT NULL,    -- Full type name for deserialization
    Payload         TEXT NOT NULL,             -- JSON serialized event
    CorrelationId   VARCHAR(64) NOT NULL,      -- For tracing
    CausationId     VARCHAR(64),               -- What caused this event
    OccurredOn      TIMESTAMP NOT NULL,
    ProcessedOn     TIMESTAMP,                 -- When it was published
    LastAttemptOn   TIMESTAMP,
    RetryCount      INTEGER DEFAULT 0,
    Error           VARCHAR(2000),
    Status          INTEGER NOT NULL DEFAULT 0, -- 0=Pending, 1=Processing, 2=Processed, 3=Failed
    RowVersion      BYTEA                      -- Concurrency token
);

CREATE INDEX idx_outbox_status ON booking.OutboxMessages(Status);
CREATE INDEX idx_outbox_occurred ON booking.OutboxMessages(OccurredOn);
```

### Polling Strategy

The `OutboxPublisherService` is a `BackgroundService` that:
1. **Polls every 1 second** (configurable via `Outbox:PollingIntervalMs`)
2. **Fetches up to 50 pending events** (configurable via `Outbox:BatchSize`)
3. **Processes in order** by `OccurredOn` (oldest first)
4. **Retries failed events** up to 5 times
5. **Marks as Failed** after max retries (manual intervention needed)

### Duplicate Event Handling

Even with the outbox, it's possible RabbitMQ receives the same event twice (e.g., publisher crashes after sending but before marking as processed). To handle this:

1. **Idempotency keys** - Every event has a unique `EventId`
2. Consumers check `IIdempotencyService` before processing: *"Have I seen event X before?"*
3. If yes, they skip it.

---

## 6. RabbitMQ Messaging Design

### Topology

```
Exchanges (Topic type):
──────────────────────
booking.exchange          → booking.commands queue
                           → booking.dlq (via DLX)
seat.exchange             → seat.commands queue
                           → seat.dlq (via DLX)
payment.exchange          → payment.commands queue
                           → payment.dlq (via DLX)
ticket.exchange           → ticket.commands queue
                           → ticket.dlq (via DLX)
notification.exchange     → notification.commands queue
                           → notification.dlq (via DLX)

Each exchange has a corresponding DLX:
booking.exchange.dlx      → booking.dlq (dead letter queue)
seat.exchange.dlx         → seat.dlq
...etc.

Dead Letter Queue (DLQ) Setup:
Each command queue has:
  x-dead-letter-exchange: <exchange>.dlx
  x-dead-letter-routing-key: <queue>.dead
  x-message-ttl: 30000 (30 seconds)
```

### Routing Keys

| Event Type | Exchange | Routing Key |
|------------|----------|-------------|
| BookingCreatedEvent | booking.exchange | booking.created |
| BookingConfirmedEvent | booking.exchange | booking.confirmed |
| BookingFailedEvent | booking.exchange | booking.failed |
| SeatReservedEvent | seat.exchange | seat.reserved |
| SeatReservationFailedEvent | seat.exchange | seat.reservation.failed |
| SeatReleasedEvent | seat.exchange | seat.released |
| PaymentAuthorizedEvent | payment.exchange | payment.authorized |
| PaymentAuthorizationFailedEvent | payment.exchange | payment.authorization.failed |
| PaymentRefundedEvent | payment.exchange | payment.refunded |
| TicketIssuedEvent | ticket.exchange | ticket.issued |
| TicketIssueFailedEvent | ticket.exchange | ticket.issue.failed |
| TicketCancelledEvent | ticket.exchange | ticket.cancelled |
| EmailSentEvent | notification.exchange | email.sent |
| EmailFailedEvent | notification.exchange | email.failed |

### Retry Strategy

```
Message consumed
       │
       ▼
  Processing...
       │
  ┌────┴────┐
  │ Success │     │ Error │
  └────┬────┘     └───┬───┘
       │              │
  ACK (removed   NACK (requeued)
  from queue)         │
                      │
              ┌───────┴──────┐
              │ Retries < 5? │
              └───────┬──────┘
                 Yes  │   No
                  │   │
              Requeue  │
              (with    │
           exponential │
            backoff)   │
                  │    ▼
                  │  Sent to DLQ
                  │  (dead letter queue)
                  │
                  ▼
            Manual investigation
            (check logs, fix bug,
             replay from DLQ)
```

### Poison Message Handling

A **poison message** is one that can never be processed successfully (e.g., malformed JSON, invalid data). Without DLQs, these would be retried forever, blocking other messages.

Our approach:
1. Each queue has a **max retry limit of 5** (`x-max-retries` header)
2. After 5 retries, the message is **auto-rejected** and routed to the DLQ
3. The DLQ stores it for manual inspection
4. A human can fix the issue and **replay** the message from the DLQ

### Message Ordering

**Important:** RabbitMQ does NOT guarantee order across multiple consumers of the same queue. Our design:
- Uses a **single consumer** per queue by default (sequential processing)
- If we need more throughput, we add more consumers, but this means no ordering guarantee
- For the booking saga, ordering matters only within a single booking's flow, which is naturally sequential since each step waits for the previous

---

## 7. API Reference

### Booking Service (`http://localhost:5001`)

#### `POST /api/bookings`

Create a new booking request.

**Request body:**
```json
{
  "seatId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "customerEmail": "customer@example.com",
  "customerName": "John Doe",
  "amount": 150.00,
  "currency": "USD",
  "idempotencyKey": "unique-key-123"  // Optional: prevents duplicate bookings
}
```

**Response (202 Accepted):**
```json
{
  "bookingId": "550e8400-e29b-41d4-a716-446655440000",
  "status": "Pending",
  "links": {
    "self": { "href": "/api/bookings/550e8400-e29b-41d4-a716-446655440000", "method": "GET" }
  }
}
```

**Possible statuses you'll see:**
| Status | Meaning |
|--------|---------|
| Pending | Just created, saga is starting |
| SeatReserved | Seat is held for you |
| PaymentAuthorized | Payment went through |
| TicketIssued | Ticket has been generated |
| Confirmed | Email sent, booking complete |
| Failed | Something went wrong |
| Compensating | Rolling back a failed booking |

#### `GET /api/bookings/{id}`

Get the current status of a booking.

### Seat Service (`http://localhost:5002`)

#### `POST /api/seats/reserve`
#### `POST /api/seats/release`

### Payment Service (`http://localhost:5003`)

#### `POST /api/payments/authorize`
#### `POST /api/payments/refund`

### Ticket Service (`http://localhost:5004`)

#### `POST /api/tickets/issue`
#### `POST /api/tickets/cancel`

### Notification Service (`http://localhost:5005`)

#### `POST /api/notifications/send`

---

## 8. Database Design

### Entity Relationship Diagrams

#### BookingDB (booking schema)

```
┌───────────────────┐        ┌─────────────────────┐
│     Bookings       │        │    BookingSagas      │
├───────────────────┤        ├─────────────────────┤
│ PK Id: UUID       │        │ PK Id: UUID         │
│ SeatId: UUID      │        │ FK BookingId: UUID  │
│ CustomerEmail     │        │ SeatId: UUID        │
│ CustomerName      │        │ Amount: decimal     │
│ Amount: decimal   │        │ CurrentStep: string │
│ Status: string    │        │ Status: string      │
│ CreatedAt         │        │ RetryCount: int     │
│ UpdatedAt         │        │ LastError: string   │
│ RowVersion (concurrency)│  │ CreatedAt           │
└───────────────────┘        │ CompletedAt         │
                             │ RowVersion          │
                             └─────────────────────┘

┌────────────────────────────────┐
│      OutboxMessages            │
├────────────────────────────────┤
│ PK Id: UUID                    │
│ EventType, Payload,            │
│ CorrelationId, Status,         │
│ RetryCount, Error, ...         │
└────────────────────────────────┘
```

#### SeatDB (seat schema)

```
┌───────────────────┐        ┌──────────────────────────┐
│      Seats         │        │    SeatReservations       │
├───────────────────┤        ├──────────────────────────┤
│ PK Id: UUID       │        │ PK Id: UUID              │
│ SeatNumber (unique)│        │ FK SeatId: UUID          │
│ Section           │        │ BookingId: UUID (unique) │
│ Price: decimal    │        │ Status: string            │
│ Status: string    │        │ ReservedAt               │
│ CreatedAt         │        │ ReleasedAt               │
│ UpdatedAt         │        │ RowVersion                │
│ RowVersion        │        └──────────────────────────┘
└───────────────────┘
```

#### PaymentDB (payment schema)

```
┌────────────────────┐
│     Payments       │
├────────────────────┤
│ PK Id: UUID        │
│ BookingId: UUID    │
│ Amount: decimal    │
│ Currency: string   │
│ Status: string     │
│ TransactionId      │
│ FailureReason      │
│ CreatedAt          │
│ ProcessedAt        │
│ RowVersion         │
└────────────────────┘
```

#### TicketDB (ticket schema)

```
┌────────────────────┐
│      Tickets       │
├────────────────────┤
│ PK Id: UUID        │
│ BookingId: UUID    │
│ TicketNumber(unique)│
│ Status: string     │
│ CreatedAt          │
│ IssuedAt           │
│ CancelledAt        │
│ RowVersion         │
└────────────────────┘
```

#### NotificationDB (notification schema)

```
┌────────────────────┐
│    EmailLogs       │
├────────────────────┤
│ PK Id: UUID        │
│ BookingId: UUID    │
│ RecipientEmail     │
│ Subject            │
│ Body               │
│ Status: string     │
│ RetryCount: int    │
│ Error              │
│ CreatedAt          │
│ SentAt             │
│ RowVersion         │
└────────────────────┘
```

### Concurrency Tokens

Every table has a `RowVersion` column (byte array). This is used for **optimistic concurrency**:

```
User A reads booking  → RowVersion = [0x01, 0x02]
User B reads booking  → RowVersion = [0x01, 0x02]

User A updates booking → RowVersion becomes [0x03, 0x04]
User B tries to update → ❌ DbUpdateConcurrencyException!
                         "Someone else modified this record"
```

This prevents lost updates when two processes try to modify the same record simultaneously.

---

## 9. Observability

### Tracing with OpenTelemetry + Jaeger

Every operation across services generates spans that are connected by a **Correlation ID**:

```
[BookingService]          [SeatService]           [PaymentService]
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│ POST /bookings   │      │ Reserve Seat     │      │ Authorize       │
│ correlation: abc │─────►│ correlation: abc │─────►│ correlation: abc│
│                  │      │ span: seat-res   │      │ span: pay-auth  │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

Jaeger UI at `http://localhost:16686` shows:
- Full trace from HTTP request through all services
- Time spent in each service
- Database query durations
- Error locations

### Metrics with Prometheus + Grafana

Each service exposes metrics at `/metrics` (Prometheus format):

| Metric | Description |
|--------|-------------|
| `booking_success_rate` | Percentage of successful bookings |
| `booking_failure_rate` | Percentage of failed bookings |
| `saga_compensations_total` | How often compensations run |
| `outbox_pending_messages` | Depth of outbox queue |
| `rabbitmq_queues_messages{dlq}` | DLQ message count |
| `message_retries_total` | How often messages are retried |
| `http_server_duration_ms` | API response times (p50, p95, p99) |

Grafana dashboard at `http://localhost:3000` (admin/admin) has pre-built panels.

### Structured Logging

All services use structured logging with JSON format:
```json
{
  "@timestamp": "2026-06-18T12:00:00Z",
  "level": "Information",
  "message": "Booking {BookingId} created. Starting saga.",
  "CorrelationId": "abc123def456",
  "BookingId": "550e8400-e29b-41d4-a716-446655440000",
  "Service": "BookingService"
}
```

---

## 10. Running Locally

### Prerequisites

- Docker Desktop (with Docker Compose)
- .NET 10 SDK (for development/debugging)
- An IDE (VS Code, Rider, Visual Studio)

### Quick Start (Full Stack)

```bash
# 1. Navigate to the backend folder
cd backend

# 2. Start everything (PostgreSQL, RabbitMQ, all 5 services, monitoring)
docker compose up -d

# 3. Check everything is running
docker compose ps

# 4. Check service health
curl http://localhost:5001/health
curl http://localhost:5002/health
curl http://localhost:5003/health
curl http://localhost:5004/health
curl http://localhost:5005/health

# 5. Test the booking flow
curl -X POST http://localhost:5001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "seatId": "00000000-0000-0000-0000-000000000001",
    "customerEmail": "test@example.com",
    "customerName": "Test User",
    "amount": 150.00
  }'
```

### Running Without Docker (Development)

```bash
# 1. Start infrastructure
docker compose up -d postgres rabbitmq jaeger

# 2. Run each service individually (in separate terminals)
cd backend/src/Services/BookingService
dotnet run --urls http://localhost:5001

cd backend/src/Services/SeatService
dotnet run --urls http://localhost:5002

cd backend/src/Services/PaymentService
dotnet run --urls http://localhost:5003

cd backend/src/Services/TicketService
dotnet run --urls http://localhost:5004

cd backend/src/Services/NotificationService
dotnet run --urls http://localhost:5005
```

### Accessing Everything

| Service | URL |
|---------|-----|
| Booking API | http://localhost:5001/swagger |
| Seat API | http://localhost:5002/swagger |
| Payment API | http://localhost:5003/swagger |
| Ticket API | http://localhost:5004/swagger |
| Notification API | http://localhost:5005/swagger |
| RabbitMQ Management | http://localhost:15672 (guest/guest) |
| Jaeger Tracing | http://localhost:16686 |
| Prometheus Metrics | http://localhost:9090 |
| Grafana Dashboards | http://localhost:3000 (admin/admin) |

### Adding Test Data

The services use EF Core Migrations which auto-create tables on startup.
For the Seat Service, you need seed data:

```bash
# Connect to PostgreSQL
docker exec -it booking-postgres psql -U postgres -d SeatDB

# Insert a test seat
INSERT INTO seat."Seats" ("Id", "SeatNumber", "Section", "Price", "Status", "CreatedAt", "RowVersion")
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'A1',
  'VIP',
  150.00,
  'Available',
  NOW(),
  '\x000000000000000000000000'::bytea
);
```

---

## 11. Deployment

### Docker Compose (Local/Dev)

The `docker-compose.yml` defines 10 containers:

```yaml
# Infrastructure
rabbitmq          # Message broker
postgres          # Database for all services
jaeger            # Distributed tracing
prometheus        # Metrics collection
grafana           # Metrics visualization
otel-collector    # OpenTelemetry collector

# Microservices
booking-service   # Port 5001
seat-service      # Port 5002
payment-service   # Port 5003
ticket-service    # Port 5004
notification-service # Port 5005
```

### Kubernetes

```bash
# Deploy to Kubernetes
kubectl apply -k kubernetes/

# Or use Helm
helm install booking-platform helm/ --namespace booking-platform --create-namespace
```

Kubernetes manifests include:
- StatefulSets for PostgreSQL and RabbitMQ (with persistent volumes)
- Deployments for all 5 microservices (2 replicas each)
- Services for internal communication
- ConfigMaps for Prometheus and OTel collector
- Liveness/Readiness probes for health checking
- Prometheus annotations for auto-discovery

---

## 12. Failure Scenarios

### Scenario 1: Seat Service is Down

**What happens:**
1. Booking Service creates the booking and publishes `SeatReservedEvent`
2. Seat Service is down, so RabbitMQ holds the message
3. When Seat Service comes back up, it consumes the message and processes it
4. Saga continues normally

**Result:** Eventual consistency is achieved. The booking waits but isn't lost.

### Scenario 2: Duplicate Payment Event

**What happens:**
1. Payment Service authorizes payment, publishes `PaymentAuthorizedEvent`
2. Outbox publisher crashes AFTER sending to RabbitMQ but BEFORE marking as processed
3. On restart, the outbox publisher picks up the same event again
4. Booking Service receives a DUPLICATE `PaymentAuthorizedEvent`

**How it's handled:**
Booking Service checks `IIdempotencyService.IsProcessedAsync(event.EventId)` → it's already processed → **skips**.

### Scenario 3: Network Partition (Services Can't Talk to RabbitMQ)

**What happens:**
1. A microservice cannot reach RabbitMQ
2. The outbox publisher keeps failing to publish events
3. Events accumulate in the `OutboxMessages` table

**How it's handled:**
1. Publisher retries with exponential backoff
2. Health check at `/health` starts returning `Unhealthy`
3. Orchestrator/K8s detects the unhealthy service and restarts it
4. When connection is restored, all pending events are published
5. **No data is lost**

### Scenario 4: Database Deadlock

**What happens:**
1. Two bookings try to reserve the same seat simultaneously
2. EF Core throws a deadlock exception

**How it's handled:**
1. EF Core's retry policy (`EnableRetryOnFailure(3)`) automatically retries
2. The second attempt will succeed or fail cleanly
3. If both fail, one gets `SeatReservationFailedEvent`, the saga compensates

### Scenario 5: Poison Message (Malformed JSON)

**What happens:**
1. A message with corrupted JSON reaches the consumer
2. Deserialization fails with an exception
3. Consumer NACKs the message

**How it's handled:**
1. After 5 retries, the message is routed to the DLQ
2. It no longer blocks the main queue
3. A developer investigates the DLQ, fixes the issue, and replays the message

---

## 13. Data Consistency

### Why Distributed Transactions Are Hard

In a monolith, you can do:
```csharp
BEGIN TRANSACTION
  INSERT INTO Bookings ...
  UPDATE Seats ...
  INSERT INTO Payments ...
COMMIT  -- All or nothing!
```

In microservices, you CANNOT do this because each service has its own database. You'd need:
- **Distributed 2PC** - a protocol where all databases agree to commit or roll back together
- This requires all services to be available, holds locks, doesn't scale

### Why Saga Replaces 2PC

The Saga pattern accepts that:
- **There will be a period of inconsistency** (eventual consistency)
- **Compensations are needed** for rollbacks
- **Each step commits immediately** (no long-held locks)

### Eventual Consistency Tradeoffs

**The system is eventually consistent, meaning:**

At any point in time, the overall state might be:
- `Bookings` says "Confirmed" but `Seats` still shows "Reserved" (not yet released)
- `Payments` says "Authorized" but `Tickets` shows "TicketIssued" (event not yet consumed)

**Within seconds (or milliseconds), all services will converge to the correct state.**

**Guarantees we DO provide:**
1. **At-least-once delivery** - Every published event will be delivered at least once
2. **Exactly-once processing** - Idempotency ensures events are processed exactly once
3. **Total order per booking** - Events for a single booking are processed in order
4. **No partial states visible externally** - The Booking API always shows the latest known state

**Guarantees we DON'T provide:**
1. **Strict serializability** - Two different users might briefly see different states
2. **Real-time consistency** - There's a small delay (usually < 1 second) between steps
3. **Global ordering** - Events for different bookings can interleave

### Duplicate Event Scenarios

Events can be duplicated in these scenarios:

| Scenario | How It Happens | How It's Handled |
|----------|---------------|------------------|
| Publisher crash after publish | Event sent to RMQ but not marked processed | Idempotent consumer skips duplicate |
| Network retry | RMQ auto-acks lost, publisher resends | EventId deduplication |
| Consumer crash after processing | Event processed but ACK not sent to RMQ | Idempotency check skips reprocessing |
| Manual replay | Developer replays events from DLQ | Idempotent consumer handles it |

---

## 14. Security

### JWT Authentication

The services are designed to accept JWT tokens. Configuration:
```json
{
  "Jwt": {
    "Authority": "https://your-auth-server",
    "Audience": "booking-platform-api"
  }
}
```

### Service-to-Service Authentication

Internal services validate each other using API keys or mutual TLS. Each service has a unique identity.

### RabbitMQ Security

- RabbitMQ is not exposed to the internet
- Default credentials should be changed in production
- TLS enabled for RabbitMQ connections in production config

### API Rate Limiting

The booking endpoint has rate limiting to prevent abuse:
- 10 requests per second per client
- Returns `429 Too Many Requests` when exceeded

### Idempotency Keys

Clients can send `IdempotencyKey` with booking requests to prevent accidental duplicate bookings (e.g., if the client retries after a timeout).

---

## 15. FAQ for Freshers

### Q1: What happens when I POST to `/api/bookings`? Walk me through the entire flow.

```
You                              BookingService       RabbitMQ         SeatService
 │                                   │                   │                │
 │──POST /api/bookings──────────────►│                   │                │
 │                                   │                   │                │
 │                             1. Create Booking         │                │
 │                             2. Save to DB             │                │
 │                             3. Save to Outbox         │                │
 │                             4. Start Saga             │                │
 │                                                                        │
 │◄──202 Accepted (bookingId)──┘    │                   │                │
 │                                   │                   │                │
 │                           OutboxPublisher sees event  │                │
 │                                   │──SeatReserved────►│                │
 │                                   │    Event          │──SeatReserved─►│
 │                                   │                   │   Routing Key  │
 │                                   │                   │                │
 │                                   │                   │          Reserve seat
 │                                   │                   │          in DB
 │                                   │                   │                │
 │                                   │◄─SeatReserved─────│◄──publish──────│
 │                                   │    Event          │   result       │
 │                                   │                   │                │
 │                             4. Update booking         │                │
 │                                to SeatReserved        │                │
 │                                                                        │
 │                          ...continues for payment, ticket, email       │
```

### Q2: Why do we need RabbitMQ? Can't services just call each other via HTTP?

If services called each other directly via HTTP (synchronous communication):
- If Seat Service is down, Booking Service is blocked
- If Payment Service is slow, the whole system slows down
- Error handling is complex (timeouts, retries, cascading failures)
- Services become tightly coupled

With RabbitMQ (asynchronous communication):
- If Seat Service is down, events queue up and get processed when it's back
- Services don't wait for each other
- Each service processes at its own pace
- Services are loosely coupled (they only know about events, not about each other)

### Q3: What's the difference between Domain Events and Integration Events?

| | Domain Event | Integration Event |
|---|---|---|
| **Scope** | Inside a single service | Across services |
| **Where used** | BookingService.Domain only | All services |
| **Published to** | Just triggers local behavior | RabbitMQ |
| **Example** | `BookingCreatedDomainEvent` | `SeatReservedEvent` |
| **Serialized?** | No, stays in memory | Yes, JSON over the wire |

### Q4: What's eventual consistency in simple terms?

Imagine you book a seat. The system says "Accepted!" but the seat isn't actually reserved yet. A second later, the seat is reserved. A few milliseconds later, the payment is authorized. Eventually, everything is consistent.

In technical terms: **The system will converge to a correct state within a bounded time, but may be temporarily inconsistent.**

### Q5: How do I add a new service?

1. Copy the folder structure from an existing service (e.g., NotificationService)
2. Create your Domain aggregates
3. Create your DbContext
4. Create your Commands/Handlers
5. Create your Outbox service
6. Create your event consumers
7. Register everything in Program.cs
8. Add your events to `BookingPlatform.Common/Events/`
9. Add RabbitMQ exchanges/queues in `rabbitmq/definitions.json`
10. Add the service to `docker-compose.yml`
11. Add K8s manifests in `kubernetes/services/`

### Q6: The build has warnings about NuGet vulnerabilities. Is that ok?

Yes. These are warnings about .NET 10 preview packages. The vulnerabilities are in transitive dependencies and don't affect our application code in a dev environment. In production, use stable .NET releases.

### Q7: How do I debug a failed booking?

1. Check the Booking Service logs: `docker compose logs booking-service`
2. Look for the `CorrelationId` in the logs
3. Open Jaeger at http://localhost:16686 and search for the CorrelationId
4. See the full trace across all services
5. Check the DLQ at RabbitMQ management (http://localhost:15672)
6. If messages are in DLQ, check the `Error` field for the failure reason

### Q8: How do I replay messages from the DLQ?

```bash
# Using RabbitMQ Management UI:
# 1. Go to Queues → booking.dlq
# 2. Click "Get Messages" to view them
# 3. To replay, publish them back to the original exchange
#    or use the "Move messages" plugin

# Using command line:
# (Install rabbitmqadmin first)
rabbitmqadmin get queue=booking.dlq count=10
rabbitmqadmin publish exchange=booking.exchange routing_key=seat.reserved payload="..."
```

### Q9: Can I run this without Docker?

Yes! You can run each service individually with `dotnet run`, but you need:
- PostgreSQL running locally (or use `docker compose up -d postgres`)
- RabbitMQ running locally (or use `docker compose up -d rabbitmq`)
- Each service configured with the correct connection strings in `appsettings.json`

### Q10: The booking flow is complex. How do I test it?

```bash
# 1. Insert a test seat
docker exec booking-postgres psql -U postgres -d SeatDB \
  -c "INSERT INTO seat.\"Seats\" (\"Id\", \"SeatNumber\", \"Section\", \"Price\", \"Status\", \"CreatedAt\", \"RowVersion\") VALUES ('00000000-0000-0000-0000-000000000001', 'A1', 'VIP', 150.00, 'Available', NOW(), '\x000000000000000000000000'::bytea);"

# 2. Create a booking
curl -s -X POST http://localhost:5001/api/bookings \
  -H "Content-Type: application/json" \
  -d '{"seatId":"00000000-0000-0000-0000-000000000001","customerEmail":"test@test.com","customerName":"Test","amount":150.00}' \
  | jq .

# 3. Check the status after a few seconds
curl -s http://localhost:5001/api/bookings/<bookingId> | jq .

# 4. Check Jaeger for the full trace at http://localhost:16686
# 5. Check Grafana for metrics at http://localhost:3000 (admin/admin)
```

---

## License

This project is for educational and portfolio purposes. It demonstrates enterprise-grade distributed systems patterns for .NET developers at all levels.

---

*Built with .NET 10, ASP.NET Core, RabbitMQ, PostgreSQL, OpenTelemetry, and Docker.*
