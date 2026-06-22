namespace BookingPlatform.Common.Events;

public record SeatReservedEvent : IntegrationEvent
{
    public Guid ReservationId { get; init; }
    public Guid BookingId { get; init; }
    public Guid SeatId { get; init; }
}

public record SeatReservationFailedEvent : IntegrationEvent
{
    public Guid BookingId { get; init; }
    public Guid SeatId { get; init; }
    public string FailureReason { get; init; } = string.Empty;
}

public record SeatReleasedEvent : IntegrationEvent
{
    public Guid BookingId { get; init; }
    public Guid SeatId { get; init; }
    public Guid ReservationId { get; init; }
}
