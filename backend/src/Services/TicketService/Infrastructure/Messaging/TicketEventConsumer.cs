using BookingPlatform.Common.Events;
using BookingPlatform.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;
using TicketService.Application.Commands;

namespace TicketService.Infrastructure.Messaging;

public class TicketEventConsumer
{
    private readonly IEventBus _eventBus;
    private readonly IMediator _mediator;
    private readonly IIdempotencyService _idempotency;
    private readonly ILogger<TicketEventConsumer> _logger;

    public TicketEventConsumer(
        IEventBus eventBus,
        IMediator mediator,
        IIdempotencyService idempotency,
        ILogger<TicketEventConsumer> logger)
    {
        _eventBus = eventBus;
        _mediator = mediator;
        _idempotency = idempotency;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        await _eventBus.SubscribeAsync<TicketIssuedEvent>(
            "ticket.commands", "ticket.issue.command", IdempotentHandle<TicketIssuedEvent>(async @event =>
            {
                _logger.LogInformation("Processing ticket issuance for booking {BookingId}", @event.BookingId);
                var command = new IssueTicketCommand(@event.BookingId);
                await _mediator.Send(command, cancellationToken);
            }), cancellationToken);

        await _eventBus.SubscribeAsync<TicketIssueFailedEvent>(
            "ticket.commands", "ticket.issue.failed", IdempotentHandle<TicketIssueFailedEvent>(async @event =>
            {
                _logger.LogWarning("Ticket issue failed for booking {BookingId}: {Reason}",
                    @event.BookingId, @event.FailureReason);
            }), cancellationToken);

        await _eventBus.SubscribeAsync<TicketCancelledEvent>(
            "ticket.commands", "ticket.cancelled", IdempotentHandle<TicketCancelledEvent>(async @event =>
            {
                _logger.LogInformation("Processing ticket cancellation for booking {BookingId}", @event.BookingId);
                var command = new CancelTicketCommand(@event.BookingId);
                await _mediator.Send(command, cancellationToken);
            }), cancellationToken);

        _logger.LogInformation("Ticket event consumers registered");
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
