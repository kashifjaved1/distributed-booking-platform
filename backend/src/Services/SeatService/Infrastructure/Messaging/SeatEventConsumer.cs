using BookingPlatform.Common.Events;
using BookingPlatform.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;
using SeatService.Application.Commands;

namespace SeatService.Infrastructure.Messaging;

public class SeatEventConsumer
{
    private readonly IEventBus _eventBus;
    private readonly IMediator _mediator;
    private readonly IIdempotencyService _idempotency;
    private readonly ILogger<SeatEventConsumer> _logger;

    public SeatEventConsumer(
        IEventBus eventBus,
        IMediator mediator,
        IIdempotencyService idempotency,
        ILogger<SeatEventConsumer> logger)
    {
        _eventBus = eventBus;
        _mediator = mediator;
        _idempotency = idempotency;
        _logger = logger;
    }

    public async Task StartAsync(CancellationToken cancellationToken = default)
    {
        await _eventBus.SubscribeAsync<SeatReservedEvent>(
            "seat.commands", "seat.reserve.command", IdempotentHandle<SeatReservedEvent>(async @event =>
            {
                _logger.LogInformation("Processing seat reservation for booking {BookingId} seat {SeatId}",
                    @event.BookingId, @event.SeatId);
                var command = new ReserveSeatCommand(@event.SeatId, @event.BookingId);
                await _mediator.Send(command, cancellationToken);
            }), cancellationToken);

        await _eventBus.SubscribeAsync<SeatReleasedEvent>(
            "seat.commands", "seat.released", IdempotentHandle<SeatReleasedEvent>(async @event =>
            {
                var command = new ReleaseSeatCommand(@event.SeatId, @event.BookingId);
                await _mediator.Send(command, cancellationToken);
            }), cancellationToken);

        _logger.LogInformation("Seat event consumers registered");
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
