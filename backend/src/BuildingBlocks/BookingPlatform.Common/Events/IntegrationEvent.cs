using BookingPlatform.Common.Models;

namespace BookingPlatform.Common.Events;

public abstract record IntegrationEvent
{
    public Guid EventId { get; init; } = Guid.NewGuid();
    public DateTime OccurredOn { get; init; } = DateTime.UtcNow;
    public string CorrelationId { get; init; } = string.Empty;
    public string EventType => GetType().FullName!;
    public string CausationId { get; init; } = string.Empty;
    public string? RoutingKey { get; set; }
}

public abstract record DomainEvent
{
    public Guid EventId { get; init; } = Guid.NewGuid();
    public DateTime OccurredOn { get; init; } = DateTime.UtcNow;
}
