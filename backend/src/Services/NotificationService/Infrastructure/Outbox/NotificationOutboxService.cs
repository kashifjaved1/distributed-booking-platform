using System.Text.Json;
using BookingPlatform.Common.Events;
using BookingPlatform.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using NotificationService.Infrastructure.Persistence;

namespace NotificationService.Infrastructure.Outbox;

public class NotificationOutboxService : IOutboxService
{
    private readonly NotificationDbContext _dbContext;
    private readonly ILogger<NotificationOutboxService> _logger;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase, WriteIndented = false
    };

    public NotificationOutboxService(NotificationDbContext dbContext, ILogger<NotificationOutboxService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task SaveEventAsync(IntegrationEvent @event, string? routingKey = null, CancellationToken cancellationToken = default)
    {
        _dbContext.OutboxMessages.Add(new OutboxMessage
        {
            Id = @event.EventId,
            EventType = @event.GetType().AssemblyQualifiedName!,
            Payload = JsonSerializer.Serialize(@event, @event.GetType(), JsonOptions),
            CorrelationId = @event.CorrelationId,
            CausationId = @event.CausationId,
            OccurredOn = @event.OccurredOn,
            RoutingKey = routingKey ?? @event.RoutingKey,
            Status = OutboxStatus.Pending
        });
    }

    public async Task<IReadOnlyList<OutboxMessage>> GetPendingEventsAsync(int batchSize = 50, CancellationToken cancellationToken = default)
    {
        return await _dbContext.OutboxMessages
            .Where(o => o.Status == OutboxStatus.Pending && o.RetryCount < 5)
            .OrderBy(o => o.OccurredOn).Take(batchSize).ToListAsync(cancellationToken);
    }

    public async Task MarkAsProcessedAsync(Guid eventId, CancellationToken cancellationToken = default)
    {
        var m = await _dbContext.OutboxMessages.FindAsync([eventId], cancellationToken);
        if (m != null) { m.Status = OutboxStatus.Processed; m.ProcessedOn = DateTime.UtcNow; await _dbContext.SaveChangesAsync(cancellationToken); }
    }

    public async Task MarkAsFailedAsync(Guid eventId, string error, CancellationToken cancellationToken = default)
    {
        var m = await _dbContext.OutboxMessages.FindAsync([eventId], cancellationToken);
        if (m != null) { m.Status = OutboxStatus.Failed; m.Error = error; await _dbContext.SaveChangesAsync(cancellationToken); }
    }

    public async Task<int> GetPendingCountAsync(CancellationToken cancellationToken = default)
        => await _dbContext.OutboxMessages.CountAsync(o => o.Status == OutboxStatus.Pending, cancellationToken);
}
