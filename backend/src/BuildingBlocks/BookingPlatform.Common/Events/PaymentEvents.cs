namespace BookingPlatform.Common.Events;

public record PaymentAuthorizedEvent : IntegrationEvent
{
    public Guid PaymentId { get; init; }
    public Guid BookingId { get; init; }
    public decimal Amount { get; init; }
}

public record PaymentAuthorizationFailedEvent : IntegrationEvent
{
    public Guid BookingId { get; init; }
    public decimal Amount { get; init; }
    public string FailureReason { get; init; } = string.Empty;
}

public record PaymentRefundedEvent : IntegrationEvent
{
    public Guid PaymentId { get; init; }
    public Guid BookingId { get; init; }
    public decimal Amount { get; init; }
}
