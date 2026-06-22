using BookingPlatform.Common.Events;
using BookingPlatform.Common.Interfaces;
using BookingService.Application.EventHandlers;
using Microsoft.Extensions.Logging;

namespace BookingService.Infrastructure.Messaging;

public class BookingEventConsumer
{
    private readonly IEventBus _eventBus;
    private readonly BookingEventHandlers _handlers;
    private readonly IIdempotencyService _idempotency;
    private readonly ILogger<BookingEventConsumer> _logger;

    public BookingEventConsumer(
        IEventBus eventBus,
        BookingEventHandlers handlers,
        IIdempotencyService idempotency,
        ILogger<BookingEventConsumer> logger)
    {
        _eventBus = eventBus;
        _handlers = handlers;
        _idempotency = idempotency;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        await _eventBus.SubscribeAsync<SeatReservedEvent>(
            "booking.commands", "seat.reserved", IdempotentHandle(async (SeatReservedEvent e) => await _handlers.HandleSeatReserved(e)), cancellationToken);

        await _eventBus.SubscribeAsync<SeatReservationFailedEvent>(
            "booking.commands", "seat.reservation.failed", IdempotentHandle(async (SeatReservationFailedEvent e) => await _handlers.HandleSeatReservationFailed(e)), cancellationToken);

        await _eventBus.SubscribeAsync<PaymentAuthorizedEvent>(
            "booking.commands", "payment.authorized", IdempotentHandle(async (PaymentAuthorizedEvent e) => await _handlers.HandlePaymentAuthorized(e)), cancellationToken);

        await _eventBus.SubscribeAsync<PaymentAuthorizationFailedEvent>(
            "booking.commands", "payment.authorization.failed", IdempotentHandle(async (PaymentAuthorizationFailedEvent e) => await _handlers.HandlePaymentAuthorizationFailed(e)), cancellationToken);

        await _eventBus.SubscribeAsync<TicketIssuedEvent>(
            "booking.commands", "ticket.issued", IdempotentHandle(async (TicketIssuedEvent e) => await _handlers.HandleTicketIssued(e)), cancellationToken);

        await _eventBus.SubscribeAsync<TicketIssueFailedEvent>(
            "booking.commands", "ticket.issue.failed", IdempotentHandle(async (TicketIssueFailedEvent e) => await _handlers.HandleTicketIssueFailed(e)), cancellationToken);

        await _eventBus.SubscribeAsync<EmailSentEvent>(
            "booking.commands", "email.sent", IdempotentHandle(async (EmailSentEvent e) => await _handlers.HandleEmailSent(e)), cancellationToken);

        await _eventBus.SubscribeAsync<EmailFailedEvent>(
            "booking.commands", "email.failed", IdempotentHandle(async (EmailFailedEvent e) => await _handlers.HandleEmailFailed(e)), cancellationToken);

        _logger.LogInformation("Booking event consumers registered");
    }

    private Func<T, Task> IdempotentHandle<T>(Func<T, Task> handler) where T : IntegrationEvent
    {
        return async (T @event) =>
        {
            var key = $"{@event.EventType}:{@event.EventId:N}";
            if (await _idempotency.IsProcessedAsync(key))
            {
                _logger.LogDebug("Skipping already processed event {EventId}", @event.EventId);
                return;
            }

            await handler(@event);
            await _idempotency.MarkAsProcessedAsync(key);
        };
    }
}
