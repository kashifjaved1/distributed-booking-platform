namespace BookingService.Domain.Aggregates;

public class SagaState
{
    public Guid Id { get; private set; }
    public Guid BookingId { get; private set; }
    public Guid SeatId { get; private set; }
    public decimal Amount { get; private set; }
    public SagaStep CurrentStep { get; private set; }
    public SagaStatus Status { get; private set; }
    public int RetryCount { get; private set; }
    public string? LastError { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? CompletedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private SagaState() { }

    public static SagaState Create(Guid bookingId, Guid seatId, decimal amount)
    {
        return new SagaState
        {
            Id = Guid.NewGuid(),
            BookingId = bookingId,
            SeatId = seatId,
            Amount = amount,
            CurrentStep = SagaStep.ReserveSeat,
            Status = SagaStatus.Running,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void AdvanceTo(SagaStep step)
    {
        CurrentStep = step;
    }

    public void Complete()
    {
        Status = SagaStatus.Completed;
        CompletedAt = DateTime.UtcNow;
    }

    public void Fail(string error)
    {
        Status = SagaStatus.Failed;
        LastError = error;
        CompletedAt = DateTime.UtcNow;
    }

    public void StartCompensation()
    {
        Status = SagaStatus.Compensating;
    }

    public void IncrementRetry()
    {
        RetryCount++;
    }

    public bool CanRetry(int maxRetries = 3) => RetryCount < maxRetries;
}

public enum SagaStep
{
    ReserveSeat = 0,
    AuthorizePayment = 1,
    IssueTicket = 2,
    SendEmail = 3,
    Completed = 4
}

public enum SagaStatus
{
    Running = 0,
    Completed = 1,
    Failed = 2,
    Compensating = 3
}
