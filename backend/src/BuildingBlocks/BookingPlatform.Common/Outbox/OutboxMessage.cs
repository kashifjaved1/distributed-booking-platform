namespace BookingPlatform.Common.Interfaces;

public class OutboxMessage
{
    public Guid Id { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string Payload { get; set; } = string.Empty;
    public string CorrelationId { get; set; } = string.Empty;
    public string CausationId { get; set; } = string.Empty;
    public string? RoutingKey { get; set; }
    public DateTime OccurredOn { get; set; }
    public DateTime? ProcessedOn { get; set; }
    public DateTime? LastAttemptOn { get; set; }
    public int RetryCount { get; set; }
    public string? Error { get; set; }
    public OutboxStatus Status { get; set; } = OutboxStatus.Pending;
    public byte[] RowVersion { get; set; } = [];
}

public enum OutboxStatus
{
    Pending = 0,
    Processing = 1,
    Processed = 2,
    Failed = 3
}
