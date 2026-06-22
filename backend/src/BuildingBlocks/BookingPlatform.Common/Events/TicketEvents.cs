namespace BookingPlatform.Common.Events;

public record TicketIssuedEvent : IntegrationEvent
{
    public Guid TicketId { get; init; }
    public Guid BookingId { get; init; }
    public string TicketNumber { get; init; } = string.Empty;
}

public record TicketIssueFailedEvent : IntegrationEvent
{
    public Guid BookingId { get; init; }
    public string FailureReason { get; init; } = string.Empty;
}

public record TicketCancelledEvent : IntegrationEvent
{
    public Guid TicketId { get; init; }
    public Guid BookingId { get; init; }
}
