using BookingPlatform.Common.Events;
using BookingPlatform.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;
using NotificationService.Application.Commands;

namespace NotificationService.Infrastructure.Messaging;

public class NotificationEventConsumer
{
    private readonly IEventBus _eventBus;
    private readonly IMediator _mediator;
    private readonly IIdempotencyService _idempotency;
    private readonly ILogger<NotificationEventConsumer> _logger;

    public NotificationEventConsumer(
        IEventBus eventBus,
        IMediator mediator,
        IIdempotencyService idempotency,
        ILogger<NotificationEventConsumer> logger)
    {
        _eventBus = eventBus;
        _mediator = mediator;
        _idempotency = idempotency;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        await _eventBus.SubscribeAsync<EmailSentEvent>(
            "notification.commands", "email.send.command", IdempotentHandle<EmailSentEvent>(async @event =>
            {
                _logger.LogInformation("Processing email notification for booking {BookingId}", @event.BookingId);
                var command = new SendEmailCommand(
                    @event.BookingId,
                    @event.RecipientEmail,
                    "Booking Confirmation",
                    $"Your booking {@event.BookingId} has been confirmed.");
                await _mediator.Send(command, cancellationToken);
            }), cancellationToken);

        await _eventBus.SubscribeAsync<EmailFailedEvent>(
            "notification.commands", "email.failed", IdempotentHandle<EmailFailedEvent>(async @event =>
            {
                _logger.LogWarning("Email failed for booking {BookingId}: {Reason}", @event.BookingId, @event.FailureReason);
            }), cancellationToken);

        _logger.LogInformation("Notification event consumers registered");
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
