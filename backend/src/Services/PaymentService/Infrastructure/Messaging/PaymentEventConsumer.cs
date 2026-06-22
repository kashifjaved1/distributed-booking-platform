using BookingPlatform.Common.Events;
using BookingPlatform.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;
using PaymentService.Application.Commands;

namespace PaymentService.Infrastructure.Messaging;

public class PaymentEventConsumer
{
    private readonly IEventBus _eventBus;
    private readonly IMediator _mediator;
    private readonly IIdempotencyService _idempotency;
    private readonly ILogger<PaymentEventConsumer> _logger;

    public PaymentEventConsumer(
        IEventBus eventBus,
        IMediator mediator,
        IIdempotencyService idempotency,
        ILogger<PaymentEventConsumer> logger)
    {
        _eventBus = eventBus;
        _mediator = mediator;
        _idempotency = idempotency;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        await _eventBus.SubscribeAsync<PaymentAuthorizedEvent>(
            "payment.commands", "payment.authorized", IdempotentHandle<PaymentAuthorizedEvent>(async @event =>
            {
                _logger.LogInformation("Processing payment authorization for booking {BookingId}", @event.BookingId);
                var command = new AuthorizePaymentCommand(@event.BookingId, @event.Amount);
                await _mediator.Send(command, cancellationToken);
            }), cancellationToken);

        await _eventBus.SubscribeAsync<PaymentAuthorizationFailedEvent>(
            "payment.commands", "payment.authorization.failed", IdempotentHandle<PaymentAuthorizationFailedEvent>(async @event =>
            {
                _logger.LogWarning("Payment authorization failed for booking {BookingId}: {Reason}",
                    @event.BookingId, @event.FailureReason);
            }), cancellationToken);

        await _eventBus.SubscribeAsync<PaymentRefundedEvent>(
            "payment.commands", "payment.refunded", IdempotentHandle<PaymentRefundedEvent>(async @event =>
            {
                _logger.LogInformation("Processing payment refund for booking {BookingId}", @event.BookingId);
                var command = new RefundPaymentCommand(@event.BookingId);
                await _mediator.Send(command, cancellationToken);
            }), cancellationToken);

        _logger.LogInformation("Payment event consumers registered");
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
