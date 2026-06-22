namespace PaymentService.Domain.Aggregates;

public class Payment
{
    public Guid Id { get; private set; }
    public Guid BookingId { get; private set; }
    public decimal Amount { get; private set; }
    public string Currency { get; private set; } = "USD";
    public PaymentStatus Status { get; private set; }
    public string? TransactionId { get; private set; }
    public string? FailureReason { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? ProcessedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private Payment() { }

    public static Payment Create(Guid bookingId, decimal amount, string currency = "USD")
    {
        return new Payment
        {
            Id = Guid.NewGuid(),
            BookingId = bookingId,
            Amount = amount,
            Currency = currency,
            Status = PaymentStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void Authorize(string transactionId)
    {
        if (Status != PaymentStatus.Pending)
            throw new InvalidOperationException($"Cannot authorize payment in status {Status}");

        Status = PaymentStatus.Authorized;
        TransactionId = transactionId;
        ProcessedAt = DateTime.UtcNow;
    }

    public void FailAuthorization(string reason)
    {
        Status = PaymentStatus.Failed;
        FailureReason = reason;
        ProcessedAt = DateTime.UtcNow;
    }

    public void Refund()
    {
        if (Status != PaymentStatus.Authorized)
            throw new InvalidOperationException($"Cannot refund payment in status {Status}");

        Status = PaymentStatus.Refunded;
        ProcessedAt = DateTime.UtcNow;
    }
}

public enum PaymentStatus
{
    Pending = 0,
    Authorized = 1,
    Failed = 2,
    Refunded = 3
}
