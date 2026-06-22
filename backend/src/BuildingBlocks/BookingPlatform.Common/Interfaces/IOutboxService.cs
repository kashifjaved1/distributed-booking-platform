using BookingPlatform.Common.Events;

namespace BookingPlatform.Common.Interfaces;

public interface IOutboxService
{
    Task SaveEventAsync(IntegrationEvent @event, string? routingKey = null, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<OutboxMessage>> GetPendingEventsAsync(int batchSize = 50, CancellationToken cancellationToken = default);
    Task MarkAsProcessedAsync(Guid eventId, CancellationToken cancellationToken = default);
    Task MarkAsFailedAsync(Guid eventId, string error, CancellationToken cancellationToken = default);
    Task<int> GetPendingCountAsync(CancellationToken cancellationToken = default);
}
