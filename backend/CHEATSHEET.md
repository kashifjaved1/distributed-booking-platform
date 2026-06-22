# Interview Cheatsheet — Distributed Booking Platform

> This document contains the most common and toughest questions interviewers will ask about this project, along with concise, high-impact answers. Use this to prepare for system design and behavioral rounds.

---

## Table of Contents

1. [Architecture & Design Decisions](#1-architecture--design-decisions)
2. [Saga Pattern Deep Dive](#2-saga-pattern-deep-dive)
3. [Transactional Outbox](#3-transactional-outbox)
4. [RabbitMQ & Messaging](#4-rabbitmq--messaging)
5. [Data Consistency & Tradeoffs](#5-data-consistency--tradeoffs)
6. [Failure Modes & Recovery](#6-failure-modes--recovery)
7. [Observability & Debugging](#7-observability--debugging)
8. [Scalability](#8-scalability)
9. [Security](#9-security)
10. [Behavioral / Ownership Questions](#10-behavioral--ownership-questions)

---

## 1. Architecture & Design Decisions

### Q: Why microservices instead of a monolith? Wasn't a monolith simpler for this use case?

**Answer:**
The prompt explicitly required a distributed system with no centralized monolith. But beyond that, microservices give us:
- **Independent deployability** — fix the Payment service without touching Booking
- **Isolated failure domains** — the Seat service going down doesn't crash the Notification service
- **Independent scaling** — Ticket service handles 10K RPM, Notification handles 100 RPM
- **Polyglot persistence** — each service could use its own DB technology if needed

**The tradeoff:** Complexity. We accept operational complexity in exchange for resilience and scale. For a portfolio project, this demonstrates I understand when to use microservices vs. when a monolith is the right call.

### Q: Why 5 services? Why not 3 or 10?

**Answer:**
Each service maps to one **bounded context** in Domain-Driven Design:
- **Booking** — the core transaction/saga state
- **Seat** — inventory management (different scaling needs)
- **Payment** — financial transactions (PCI compliance scope)
- **Ticket** — document generation (different failure mode)
- **Notification** — non-critical async side effect

If I merged Seat and Payment into one service, I'd couple inventory concerns with financial concerns — they change for different reasons and at different velocities. If I split further (e.g., separate Email service), I'd add network overhead without clear benefit.

### Q: How did you ensure services are loosely coupled?

**Answer:**
Three mechanisms:
1. **No shared databases** — each service owns its schema and data. Services never read each other's tables
2. **Event-driven communication** — services publish events and consume events. They never call each other's HTTP APIs for business logic
3. **Shared nothing in the common library** — `BookingPlatform.Common` only has contracts (interfaces, event definitions, base classes). No shared business logic. Domain logic lives inside each service

### Q: Why PostgreSQL for every service? Why not use different databases suited to each service?

**Answer:**
PostgreSQL is used consistently to simplify the infrastructure footprint for this demo. In production, I'd evaluate:
- **Booking Service** — PostgreSQL is fine (relational, ACID needed for saga state)
- **Seat Service** — could benefit from Redis for real-time inventory (high write volume, low latency needs)
- **Notification Service** — could use a document DB like MongoDB (append-only logs, no joins)

The architecture allows swapping databases per service since each has its own `DbContext` and repository layer. The domain doesn't leak into persistence decisions.

---

## 2. Saga Pattern Deep Dive

### Q: Explain the Saga pattern like I'm a junior developer.

**Answer:**
Imagine ordering a pizza:
1. You call the restaurant (Booking Service)
2. Restaurant checks they have ingredients (Seat Service)
3. They charge your card (Payment Service)
4. They cook the pizza (Ticket Service)
5. They call you to pick it up (Notification Service)

If your card fails AFTER they started cooking, they can't "un-cook" the pizza. Instead, they:
- Refund the charge (compensation for Payment)
- Put the ingredients back (compensation for Seat)
- Throw away the half-cooked pizza (compensation for Ticket)

**That's a Saga.** Each step commits to its own database immediately. If something fails, earlier steps run compensating actions to undo their work. No distributed transaction needed.

### Q: Orchestrated vs Choreographed Saga — why did you pick Orchestrated?

**Answer:**
| Aspect | Orchestrated | Choreographed |
|--------|-------------|---------------|
| Coordination | Central `BookingSagaOrchestrator` decides what's next | Services react to events and decide independently |
| Visibility | Single place to see saga state (`BookingSagas` table) | State is distributed across all services |
| Complexity | Orchestrator is the "brain" — simpler to reason about | Each service needs saga logic — harder to debug |
| Coupling | Services don't know about each other — only the orchestrator does | Services must know what event to emit next |

I chose **orchestrated** because:
- The saga logic is complex (3 failure scenarios with different compensations)
- I need a single `BookingSagas` table to track state for observability
- Services stay dumb — they just do their job and report results
- For a portfolio project, the orchestrator demonstrates I understand state machines

### Q: Walk me through the state machine transitions for a successful booking.

**Answer:**
```
Status: Pending       → Booking created, saga started
Status: SeatReserved  → SeatReservedEvent consumed by BookingService
Status: PaymentAuth   → PaymentAuthorizedEvent consumed
Status: TicketIssued  → TicketIssuedEvent consumed
Status: EmailPending  → EmailSentEvent published, waiting for result
Status: Confirmed     → EmailSentEvent consumed back → Done
```

Each transition is:
1. `BookingSagaOrchestrator` publishes a command event (e.g., `SeatReservedEvent`)
2. The target service processes it and publishes a result event
3. `BookingSagaOrchestrator` receives the result via a consumer
4. It advances the saga state in the `BookingSagas` table
5. If the result is a failure, it triggers compensation

### Q: What happens if the orchestrator itself crashes mid-saga?

**Answer:**
The `BookingSagas` table is the source of truth. On restart:
1. The orchestrator reads all saga instances with `Status = Running`
2. For each, it checks the `CurrentStep` and continues from there
3. Any events published before the crash are idempotently handled by consumers
4. Any events that were lost will be picked up when the next step republishes

**No state is lost** because the saga state is persisted in PostgreSQL before any event is published (outbox pattern ensures atomicity of state + event).

### Q: Could you have used a workflow engine like Temporal or Azure Durable Functions instead?

**Answer:**
Yes, and that would be the production choice. Temporal gives you:
- Automatic retries with exponential backoff
- Deterministic replay for crash recovery
- Built-in timeout and timer support

I chose to implement it manually for this project to demonstrate I understand the underlying patterns. In production, I'd recommend Temporal for complex saga orchestration because the manual approach requires careful handling of:
- Crash recovery (re-reading saga state)
- Timeout detection
- Concurrent saga executions
- Deadlocks in saga state transitions

### Q: Explain the three compensation flows in detail.

**Answer:**

**Flow 1: Seat Reserved → Payment Failed**
```
1. Seat reserved successfully
2. Payment authorization fails
3. Compensation: Publish SeatReleasedEvent
4. Seat Service releases the seat
5. Booking marked as Failed
```
**Why:** Only the seat was reserved. We need to undo that one thing.

**Flow 2: Seat Reserved → Payment Authorized → Ticket Failed**
```
1. Seat reserved
2. Payment authorized (money is captured from customer)
3. Ticket generation fails
4. Compensation Step 1: Publish PaymentRefundedEvent
   → Payment Service refunds the customer
5. Compensation Step 2: Publish SeatReleasedEvent
   → Seat Service releases the seat
6. Booking marked as Failed
```
**Why:** Two things were done. We must undo them in reverse order. Money first, then seat.

**Flow 3: Seat Reserved → Payment Authorized → Ticket Issued → Email Failed**
```
1. Seat reserved
2. Payment authorized
3. Ticket issued
4. Email sending fails
5. NO compensation needed. Booking marked as Confirmed.
6. Notification Service retries email asynchronously (up to 5 times)
```
**Why:** The booking is complete. The email is a non-critical notification. We don't undo a successful booking just because an email failed. This is a deliberate business decision: **email is eventually consistent**.

---

## 3. Transactional Outbox

### Q: What problem does the Outbox pattern solve?

**Answer:**
The **dual-write problem**. When a service needs to:
1. Save to its database
2. Publish an event

...doing these as two separate operations risks inconsistency:
- DB succeeds, RabbitMQ publish fails → **event lost forever**
- RabbitMQ publish succeeds, DB fails → **phantom event** for data that doesn't exist

The outbox pattern solves this by making both operations part of a **single database transaction**:
1. `INSERT INTO OutboxMessages (...)` — happens in the same transaction as the business data
2. `COMMIT` — both succeed or both fail atomically
3. A background worker reads the outbox and publishes to RabbitMQ
4. Marks the event as `Processed` after successful publish

### Q: How does the OutboxPublisherService work? Walk me through the code.

**Answer:**
It's a `BackgroundService` with a polling loop:

```
while (!stoppingToken)
    1. Query OutboxMessages WHERE Status = Pending AND RetryCount < 5
       ORDER BY OccurredOn ASC, LIMIT 50
    2. For each message:
       a. Deserialize JSON back to IntegrationEvent
       b. Publish to RabbitMQ via IEventBus
       c. Mark as Processed
       d. If fails: increment RetryCount. If >= 5, mark as Failed.
    3. Wait 1 second (configurable)
```

Key design decisions:
- **Polling interval** — 1 second balances freshness vs. DB load
- **Batch size** — 50 prevents memory pressure
- **Ordering** — oldest first ensures messages are delivered in order per aggregate
- **Max retries** — 5 prevents infinite loops from poison messages

### Q: Could you use Change Data Capture (CDC) instead of polling?

**Answer:**
Yes. PostgreSQL has built-in CDC via logical replication (pgoutput plugin). Instead of polling the OutboxMessages table, we could:
1. Stream changes directly from the WAL (Write-Ahead Log)
2. Push them to RabbitMQ via Debezium or a custom CDC consumer

**Pros of CDC:**
- No polling latency (sub-millisecond)
- No DB query overhead every second
- Captures ALL changes, even those from other tools

**Why I chose polling for this project:**
- Simpler to implement and understand
- No additional infrastructure (Debezium connector, Kafka)
- 1-second latency is acceptable for a booking system
- CDC would be the production choice for high-throughput systems

### Q: What's in the Outbox table schema and why?

**Answer:**
```sql
Id              UUID        -- Primary key, unique event identifier
EventType       VARCHAR(500)-- Full .NET type name for deserialization
Payload         TEXT        -- JSON-serialized event
CorrelationId   VARCHAR(64) -- For distributed tracing
CausationId     VARCHAR(64) -- What caused this event (parent event ID)
OccurredOn      TIMESTAMP   -- When the event was created
ProcessedOn     TIMESTAMP   -- When it was successfully published
RetryCount      INTEGER     -- How many times we've tried
Error           VARCHAR(2000)-- Last error message
Status          INTEGER     -- 0=Pending, 1=Processing, 2=Processed, 3=Failed
```

Notable design choices:
- **EventType as full type name** — enables polymorphic deserialization. The publisher reads the type, calls `Type.GetType()`, and deserializes the correct concrete class
- **RowVersion** — concurrency token prevents two publisher instances from processing the same message
- **Index on (Status, RetryCount, OccurredOn)** — covers the primary query pattern
- **No foreign keys** — the outbox is append-only, no relationships needed

---

## 4. RabbitMQ & Messaging

### Q: Why RabbitMQ over Kafka?

**Answer:**
| Requirement | RabbitMQ | Kafka |
|-------------|----------|-------|
| Complex routing (topic exchanges) | ✅ Native | ❌ Requires stream processing |
| DLQ support | ✅ Built-in | ❌ Requires separate consumer |
| Message TTL | ✅ Per-queue | ❌ Not native |
| Low latency | ✅ Sub-millisecond | ✅ Sub-millisecond |
| Throughput | ~50K msg/sec | ~1M+ msg/sec |
| Message ordering per partition | ✅ | ✅ |
| Consumer groups | ❌ (competing consumers) | ✅ Native |

**Why RabbitMQ wins here:**
- We need **complex routing** (different events to different queues via routing keys)
- We need **DLQs** with TTL for poison message handling
- Our throughput is moderate (not millions/sec)
- RabbitMQ's topic exchanges map perfectly to our event types
- The retry/DLQ mechanics are simpler to configure in RabbitMQ

**When I'd use Kafka instead:** For event sourcing, high-throughput logging, or when we need to replay events from the beginning of time.

### Q: Explain your routing key strategy.

**Answer:**
Routing keys follow the pattern: `{noun}.{action}` in lowercase with dots:
```
seat.reserved
seat.reservation.failed
payment.authorized
ticket.issued
email.sent
```

This is generated automatically from the event class name:
```csharp
// Event class: SeatReservedEvent
// After stripping "Event" suffix: SeatReserved
// After inserting dots: seat.reserved
```

Benefits:
- **Predictable** — any developer knows the routing key pattern
- **Hierarchical** — we can use wildcards: `seat.*` matches all seat events
- **Self-documenting** — the event name IS the routing key

### Q: What are Dead Letter Queues and how do they work in this system?

**Answer:**
A Dead Letter Queue (DLQ) is a queue where messages go when they can't be processed successfully.

**How it works:**
1. Each command queue has `x-dead-letter-exchange` pointing to a DLX
2. A message that is NACKed (rejected) and has exceeded retry count goes to the DLX
3. The DLX routes it to the `.dlq` queue

**Why I set it up:**
- Prevents poison messages from blocking the main queue forever
- Provides a manual inspection point for failed messages
- Allows replaying messages after fixing the underlying issue

**DLQ setup:**
```
booking.commands ──DLX──► booking.exchange.dlx ──► booking.dlq
seat.commands    ──DLX──► seat.exchange.dlx    ──► seat.dlq
payment.commands ──DLX──► payment.exchange.dlx ──► payment.dlq
ticket.commands  ──DLX──► ticket.exchange.dlx  ──► ticket.dlq
notification.cmd ──DLX──► notification.exch.dlx ──► notification.dlq
```

### Q: How do you handle message ordering when a single booking's events could end up on different queues?

**Answer:**
Each booking's saga steps are **sequential by design**:
1. Step 1 completes → publishes event → consumer receives → advances saga → Step 2
2. Step 2 only starts AFTER Step 1's result is received

Since each step waits for the previous step's result event before publishing the next command, there's no ordering contention within a single booking.

**Across different bookings:** Order doesn't matter. Booking A and Booking B are independent.

**One queue per service** ensures that events for the same service are processed in order (assuming a single consumer, which we use).

### Q: What happens when RabbitMQ goes down?

**Answer:**
1. Producers can't publish → outbox events accumulate in the database
2. Consumers can't consume → saga stalls mid-flight
3. Health checks start returning `Unhealthy`

**Recovery:**
1. RabbitMQ comes back up (automatic recovery in `ConnectionFactory`)
2. All producers reconnect
3. Outbox publisher resumes publishing accumulated events
4. Consumers resume processing
5. Booking saga continues from where it stalled

**No data is lost** because:
- Unpublished events are safe in the OutboxMessages table
- In-flight events are persisted by RabbitMQ (durable queues)
- Consumers use manual ACK, so unprocessed messages are redelivered

---

## 5. Data Consistency & Tradeoffs

### Q: This system is eventually consistent. What does that mean in practice?

**Answer:**
After a booking is created, there's a window (typically 100ms–2s) where the system state may be inconsistent:

```
Time:  T0          T1          T2          T3          T4
       │           │           │           │           │
Event: Create   Seat       Payment    Ticket      Email
       Booking   Reserved   Authorized Issued      Sent
                (100ms)    (200ms)    (300ms)     (400ms)
        
System  Booking    Booking    Booking    Booking    Booking
State:  Pending    SeatRes    PayAuth    TcktIss    Confirmed
```

At T0–T1, the system says "Pending" but the seat isn't reserved yet.
At T1–T2, the seat is reserved but payment hasn't been authorized.

**What this means for users:**
- User sees "Booking created" immediately
- A few seconds later, it becomes "Confirmed"
- If something fails, it becomes "Failed" with a reason

**What we guarantee:**
- The system will converge to the correct final state (Confirmed or Failed)
- The user will never see a permanently stuck booking
- The booking state is always accurate for the user who made it

### Q: Could you have used a distributed transaction (2PC) instead? Why didn't you?

**Answer:**
Yes, but 2PC is the wrong choice for microservices:

| 2PC | Saga (our approach) |
|-----|---------------------|
| All participants must be available | Works with partial failures |
| Locks resources for the duration | Each step commits immediately |
| Single coordinator = SPOF | Distributed coordination |
| Poor performance under contention | Scales linearly |
| Doesn't work across different DB types | Works with any data store |
| Not supported by all message brokers | Works with any broker |

**The key insight:** 2PC guarantees consistency at the cost of availability. Sagas guarantee availability at the cost of temporary inconsistency. For a booking system, availability matters more than instant consistency.

This is the **CAP theorem** in action. We chose **Availability and Partition tolerance** over **Consistency**.

### Q: How do you handle duplicate events?

**Answer:**
Three layers of protection:

**Layer 1: Transactional Outbox**
The outbox ensures an event is written to the DB atomically with the business data. The background publisher marks it `Processed` after successful publish. If the publisher crashes between publish and marking, it republishes on restart.

**Layer 2: Idempotent Consumers**
Every event handler implements `IIdempotencyService`:
```csharp
var key = $"{@event.EventType}:{@event.EventId:N}";
if (await _idempotency.IsProcessedAsync(key))
    return; // Already processed
```

**Layer 3: Database Constraints**
Business-level uniqueness constraints prevent duplicates:
- `SeatReservations(BookingId)` has a UNIQUE index
- `Payments(BookingId)` has a UNIQUE index
- `Tickets(BookingId)` has a UNIQUE index

If an idempotency check fails and a duplicate slips through, the DB constraint catches it.

### Q: What happens if the Booking Service saves the outbox event but the background publisher crashes before publishing?

**Answer:**
On restart:
1. `OutboxPublisherService` starts and queries for `Status = Pending`
2. It finds the unpublished event
3. It publishes it to RabbitMQ

The consumer sees a legitimate event and processes it normally. **No data loss.**

But what if the event was already published and only the "mark as processed" failed? The consumer receives a duplicate. This is handled by **idempotent consumers** (see above).

---

## 6. Failure Modes & Recovery

### Q: Walk me through what happens when Payment Service is completely down during a booking.

**Answer:**
1. Booking Service reserves the seat successfully ✓
2. Booking Service publishes `PaymentAuthorizedEvent` to payment.commands queue
3. Payment Service is DOWN — the event stays in the queue
4. Booking Service is awaiting `PaymentAuthorizedEvent` or `PaymentAuthorizationFailedEvent`
5. **The saga stalls** at `SeatReserved` status

**Recovery:**
- When Payment Service comes back up, it connects to RabbitMQ
- It starts consuming from `payment.commands`
- It processes the queued `PaymentAuthorizedEvent`
- It publishes the result event back
- Booking Service receives it and continues the saga

**What about the customer?** The booking shows `SeatReserved` status. The system doesn't time out the reservation. In a production system, we'd add a TTL on the reservation (e.g., "hold seat for 15 minutes") and a saga timeout.

### Q: How do you handle the scenario where the Saga Orchestrator itself is the bottleneck?

**Answer:**
The orchestrator is lightweight by design:
- It doesn't do any heavy computation
- It only orchestrates: receive event → update state → publish next event
- This is a sub-millisecond operation per booking

**Scaling:** The orchestrator is just a collection of event handlers running in the Booking Service. If needed:
1. Add more Booking Service instances (horizontal scaling)
2. Each instance has its own saga consumers
3. Since each booking is independent, consumers can process different bookings in parallel
4. RabbitMQ distributes events across instances

**The real bottleneck** is usually the database, not the orchestrator. If BookingDB can't keep up with saga state updates, we add read replicas or shard by booking ID.

### Q: What's the disaster recovery plan if PostgreSQL data is corrupted?

**Answer:**
Our system has two sources of truth:
1. **Database** — current state (Bookings, Seats, etc.)
2. **Event history** — every state change was published as an event (potentially in DLQ or log)

**Recovery strategy:**
1. Restore from the latest PostgreSQL backup
2. Replay events from the backup timestamp to catch up
3. Any events that can't be replayed from the DB can be reconstructed from service logs or Jaeger traces

**Prevention:**
- `RowVersion` concurrency tokens prevent accidental overwrites
- PostgreSQL WAL archiving provides point-in-time recovery
- Each service has its own DB → blast radius is limited to one service

---

## 7. Observability & Debugging

### Q: How does distributed tracing work across 5 services?

**Answer:**
Every event propagates a `CorrelationId`:

```
HTTP Request
  │
  ├─ X-Correlation-Id: abc123
  │
  └─ Booking Service
       │
       ├─ Activity.Start("ReserveSeat")
       │   └─ Tags: booking.id, seat.id
       │
       ├─ Publishes SeatReservedEvent
       │   └─ CorrelationId: abc123 (propagated)
       │
       └─ Seat Service (receives event)
            │
            ├─ Activity.Start("ProcessSeatReservation")
            │   └─ Tags: seat.id, booking.id
            │
            └─ Continues the chain...
```

Jaeger collects all these spans via the OpenTelemetry Collector. A single trace shows:
- The entire HTTP request timeline
- Every RabbitMQ publish and consume
- Every database query with duration
- Where errors occurred
- The correlation ID linking everything together

**To debug a failure:**
1. Get the `CorrelationId` from the API response
2. Go to Jaeger → Search by CorrelationId
3. See the full trace across all 5 services
4. Find the exact span where the error occurred
5. Check the logs for that span

### Q: What metrics would you alert on in production?

**Answer:**
**P0 Alerts (immediate page):**
- `booking_failure_rate > 5%` over 5 minutes
- `outbox_pending_messages > 1000` (events are piling up)
- `dlq_message_count > 0` (poison messages need attention)
- `http_server_duration_ms p99 > 5s`
- Any service health check failing

**P1 Alerts (business hours):**
- `saga_compensations_total > 10/minute` (unusual failure pattern)
- `message_retries_total > 100/minute`
- `booking_success_rate < 95%` over 1 hour

**P2 Alerts (ticket):**
- Slow DB queries (> 500ms)
- Low disk space on PostgreSQL volumes
- Certificate expiry warnings

---

## 8. Scalability

### Q: How would you scale this system to handle 10,000 bookings per second?

**Answer:**
**Horizontal scaling for services:**
- Each service runs behind a load balancer with auto-scaling (HPA in K8s)
- Booking Service scales based on CPU/memory
- Seat Service needs careful scaling — seat inventory is a contention point

**Seat inventory bottleneck:**
- All 10K TPS trying to book seat "A1" → row-level lock contention
- Solution: **shard by seat** or use **Redis** for real-time inventory with write-behind to PostgreSQL

**RabbitMQ:**
- Add more consumer instances (increase prefetch count)
- Consider partitioning high-volume queues (seat.reserved)
- If RabbitMQ becomes the bottleneck: shard by booking ID across multiple RabbitMQ clusters

**Database:**
- Read replicas for GET endpoints
- Connection pooling (Npgsql handles this natively)
- If write contention: partition BookingDB by date range (hot partition for today's bookings)

**Outbox:**
- Increase poll frequency from 1s to 100ms
- Increase batch size from 50 to 500
- Add more publisher instances (but watch for duplicate publication — idempotency handles it)

### Q: What's the main bottleneck in this system?

**Answer:**
The **Seat Service database** is the primary contention point because:
- Multiple bookings can try to reserve the same seat simultaneously
- Row-level locks on the `Seats` table serialize these requests
- `EnableRetryOnFailure(3)` handles deadlocks but adds latency

**Mitigations:**
1. **Optimistic concurrency** — use `RowVersion` to detect conflicts without locks
2. **Redis cache** — check seat availability in Redis first, commit to PostgreSQL later
3. **Shard by section** — split seats across physical databases by section (VIP, Economy, etc.)
4. **Batch reservations** — group seat operations for efficiency

The Saga Orchestrator itself is NOT a bottleneck because it's purely event-driven and stateless (state is in the DB).

---

## 9. Security

### Q: How do services authenticate to each other?

**Answer:**
In the current implementation, services communicate through RabbitMQ internally, so they don't call each other's HTTP APIs. RabbitMQ authentication uses username/password (configurable in secrets).

**For production, I'd add:**
1. **mTLS** between services — each service has a certificate
2. **JWT validation** on all external API endpoints
3. **RabbitMQ TLS** — encrypted connections between services and RabbitMQ
4. **Network policies** in Kubernetes — only allow traffic on specific ports between specific services

### Q: How do you prevent a client from booking the same seat twice?

**Answer:**
Three layers:

1. **Idempotency Key** — client sends `IdempotencyKey` header. If they retry with the same key, the server returns the previous result without processing again.

2. **Database constraints** — `SeatReservations(BookingId)` has a UNIQUE index. One booking can't have two reservations.

3. **Seat-level lock** — when Seat Service reserves a seat, it uses `SELECT ... FOR UPDATE` to lock the row, preventing concurrent reservations.

### Q: Where are secrets stored?

**Answer:**
In the current `appsettings.json` files for local development. In production:
- Kubernetes secrets (base64 encoded, then encrypted at rest)
- HashiCorp Vault for dynamic secrets
- GitHub Actions secrets for CI/CD
- Never committed to git (`.gitignore` handles this)

---

## 10. Behavioral / Ownership Questions

### Q: Why did you build this project? What problem were you solving?

**Answer:**
This is a portfolio project demonstrating distributed systems patterns at an enterprise level. The "problem" is a common real-world scenario: a booking workflow that spans multiple services and requires coordinated failure handling.

The key learning goals were:
1. Implement Saga pattern correctly with compensation flows
2. Solve the dual-write problem with Transactional Outbox
3. Design event-driven communication that's resilient to failure
4. Build an observable system with distributed tracing
5. Demonstrate production-ready practices (health checks, idempotency, DLQs)

### Q: What would you do differently if you rebuilt this?

**Answer:**
1. **Use Temporal as the saga engine** — manual saga orchestration is error-prone. Temporal handles retries, timeouts, and state persistence out of the box.
2. **CDC instead of polling outbox** — Debezium + Kafka for lower-latency event publication.
3. **API Gateway** — add a gateway (YARP, Envoy, or Kong) for authentication, rate limiting, and routing.
4. **gRPC for internal commands** — RabbitMQ is great for events, but gRPC would be faster for command/response patterns within the saga.
5. **Feature flags** — to toggle between saga versions or route traffic to new service versions.
6. **More comprehensive testing** — chaos engineering (Simian Army, Litmus) to validate failure scenarios.

### Q: How did you ensure code quality?

**Answer:**
- **Domain-Driven Design** — aggregate roots enforce invariants. `Booking.Create()` validates parameters before creating the entity. `MarkSeatReserved()` checks the current status before transitioning.
- **Clean Architecture** — domain layer has zero dependencies on infrastructure. Tests can be written against domain logic without setting up databases.
- **No comments in code** — the code is self-documenting. Method names describe intent.
- **Consistent patterns** — every service follows the same structure (Domain → Application → Infrastructure → Api).
- **Build verification** — the solution compiles with 0 errors before any commit.

### Q: How would you test this system?

**Answer:**
| Test Type | What | Tool |
|-----------|------|------|
| Unit | Domain logic, saga state transitions | xUnit + Moq |
| Integration | DbContext, outbox service, event handlers | TestContainers (PostgreSQL + RabbitMQ) |
| Component | Single service in isolation, mocked dependencies | WireMock + TestContainers |
| Contract | Event schemas, API contracts | Pact (CDC testing) |
| End-to-End | Full booking flow across all services | Docker Compose + HttpClient |
| Chaos | Kill services mid-saga, network partitions | LitmusChaos |

### Q: What's the hardest bug you encountered while building this?

**Answer:**
(Be ready with a real example. A good one for this project:)

"The hardest bug was a **phantom event** caused by the outbox publisher publishing an event successfully but crashing before marking it as processed. On restart, it republished the same event. The consumer processed it — but wait, we have idempotency. The bug was that the idempotency check happened AFTER the handler started, not before.

I fixed it by moving the idempotency check to the **wrapper** that calls the handler, ensuring we check BEFORE any business logic runs. This is now in the `IdempotentHandle` method in each consumer."

---

## Quick Reference: Key Architecture Facts

| Fact | Detail |
|------|--------|
| Number of services | 5 microservices |
| Languages | C# (.NET 10, ASP.NET Core) |
| Databases | 5 PostgreSQL databases (one per service) |
| Message broker | RabbitMQ 4 (topic exchanges) |
| Saga type | Orchestrated (BookingSagaOrchestrator) |
| Event delivery | At-least-once (via outbox) |
| Processing | Exactly-once (via idempotency) |
| Consistency model | Eventual consistency |
| Compensation | Release seat → Refund payment → Cancel ticket |
| Tracing | OpenTelemetry → Jaeger |
| Metrics | Prometheus → Grafana |
| Outbox polling | 1 second interval, 50 batch size |
| Max retries | 5 (before DLQ) |
| Containerization | Docker Compose + Kubernetes |
| API style | REST (JSON) |

---

## Buzzwords to Use (and What They Mean)

| Buzzword | Context |
|----------|---------|
| **Eventual Consistency** | The system converges to a correct state over time, not instantly |
| **Idempotency** | Processing the same event twice produces the same result as processing it once |
| **Compensating Transaction** | An action that undoes a previous action (the "undo" of microservices) |
| **Bounded Context** | A service's boundary where its domain model is valid |
| **Correlation ID** | A unique ID that traces a request across all services |
| **Poison Message** | A message that can never be processed successfully |
| **Concurrency Token** | A version number that prevents lost updates (RowVersion) |
| **Dual-Write Problem** | The challenge of atomically updating a database and publishing an event |
| **Change Data Capture** | Streaming database changes in real-time |
| **Span** | A single unit of work in a distributed trace |
| **At-Least-Once Delivery** | An event will be delivered at least once (may be duplicated) |
| **Exactly-Once Processing** | An event will be processed exactly once (duplicates detected and skipped) |

---

*Prepared for: Staff Engineer Portfolio — Distributed Booking Platform*

*Remember: Interviewers care more about WHY you made a decision than WHAT you built. Always lead with the tradeoff analysis.*
