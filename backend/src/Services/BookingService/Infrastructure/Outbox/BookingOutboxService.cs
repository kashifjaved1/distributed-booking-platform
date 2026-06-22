using System.Text.Json;
using BookingPlatform.Common.Events;
using BookingPlatform.Common.Interfaces;
using BookingService.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;

namespace BookingService.Infrastructure.Outbox;

public class BookingOutboxService : IOutboxService
{
    private readonly BookingDbContext _dbContext;
    private readonly ILogger<BookingOutboxService> _logger;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    public BookingOutboxService(BookingDbContext dbContext, ILogger<BookingOutboxService> logger)
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
        _logger.LogDebug("Saved outbox event {EventId} of type {EventType}", @event.EventId, @event.EventType);
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
