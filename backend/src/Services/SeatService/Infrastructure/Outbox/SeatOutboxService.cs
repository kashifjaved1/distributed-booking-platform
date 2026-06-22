using System.Text.Json;
using BookingPlatform.Common.Events;
using BookingPlatform.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using SeatService.Infrastructure.Persistence;

namespace SeatService.Infrastructure.Outbox;

public class SeatOutboxService : IOutboxService
{
    private readonly SeatDbContext _dbContext;
    private readonly ILogger<SeatOutboxService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public SeatOutboxService(SeatDbContext dbContext, ILogger<SeatOutboxService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    public async Task SaveEventAsync(IntegrationEvent @event, string? routingKey = null, CancellationToken cancellationToken = default)
    {
        var outboxMessage = new OutboxMessage
        {
            Id = @event.EventId,
            EventType = @event.GetType().AssemblyQualifiedName!,
            Payload = JsonSerializer.Serialize(@event, @event.GetType(), JsonOptions),
            CorrelationId = @event.CorrelationId,
            CausationId = @event.CausationId,
            OccurredOn = @event.OccurredOn,
            RoutingKey = routingKey ?? @event.RoutingKey,
            Status = OutboxStatus.Pending
        };

        await _dbContext.OutboxMessages.AddAsync(outboxMessage, cancellationToken);
    }

    public async Task<IReadOnlyList<OutboxMessage>> GetPendingEventsAsync(int batchSize = 50, CancellationToken cancellationToken = default)
    {
        return await _dbContext.OutboxMessages
            .Where(o => o.Status == OutboxStatus.Pending && o.RetryCount < 5)
            .OrderBy(o => o.OccurredOn)
            .Take(batchSize)
            .ToListAsync(cancellationToken);
    }

    public async Task MarkAsProcessedAsync(Guid eventId, CancellationToken cancellationToken = default)
    {
        var message = await _dbContext.OutboxMessages.FindAsync([eventId], cancellationToken);
        if (message != null)
        {
            message.Status = OutboxStatus.Processed;
            message.ProcessedOn = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task MarkAsFailedAsync(Guid eventId, string error, CancellationToken cancellationToken = default)
    {
        var message = await _dbContext.OutboxMessages.FindAsync([eventId], cancellationToken);
        if (message != null)
        {
            message.Status = OutboxStatus.Failed;
            message.Error = error;
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
    }

    public async Task<int> GetPendingCountAsync(CancellationToken cancellationToken = default)
    {
        return await _dbContext.OutboxMessages
            .CountAsync(o => o.Status == OutboxStatus.Pending, cancellationToken);
    }
}
