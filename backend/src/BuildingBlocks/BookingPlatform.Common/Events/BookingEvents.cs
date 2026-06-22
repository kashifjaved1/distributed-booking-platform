namespace BookingPlatform.Common.Events;

public record BookingCreatedEvent : IntegrationEvent
{
    public Guid BookingId { get; init; }
    public Guid SeatId { get; init; }
    public string CustomerEmail { get; init; } = string.Empty;
    public decimal Amount { get; init; }
}

public record BookingConfirmedEvent : IntegrationEvent
{
    public Guid BookingId { get; init; }
}

public record BookingFailedEvent : IntegrationEvent
{
    public Guid BookingId { get; init; }
    public string FailureReason { get; init; } = string.Empty;
    public string FailedStep { get; init; } = string.Empty;
}
