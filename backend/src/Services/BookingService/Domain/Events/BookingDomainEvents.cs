namespace BookingService.Domain.Events;

public abstract record BookingDomainEvent
{
    public Guid EventId { get; init; } = Guid.NewGuid();
    public DateTime OccurredOn { get; init; } = DateTime.UtcNow;
}

public record BookingCreatedDomainEvent(
    Guid BookingId,
    Guid SeatId,
    string CustomerEmail,
    string CustomerName,
    decimal Amount) : BookingDomainEvent;

public record BookingConfirmedDomainEvent(Guid BookingId) : BookingDomainEvent;

public record BookingFailedDomainEvent(Guid BookingId, string Reason) : BookingDomainEvent;
