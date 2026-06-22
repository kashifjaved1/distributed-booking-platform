namespace BookingPlatform.Common.Events;

public record EmailSentEvent : IntegrationEvent
{
    public Guid NotificationId { get; init; }
    public Guid BookingId { get; init; }
    public string RecipientEmail { get; init; } = string.Empty;
}

public record EmailFailedEvent : IntegrationEvent
{
    public Guid BookingId { get; init; }
    public string RecipientEmail { get; init; } = string.Empty;
    public string FailureReason { get; init; } = string.Empty;
}
