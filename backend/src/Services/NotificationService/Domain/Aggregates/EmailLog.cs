namespace NotificationService.Domain.Aggregates;

public class EmailLog
{
    public Guid Id { get; private set; }
    public Guid BookingId { get; private set; }
    public string RecipientEmail { get; private set; } = string.Empty;
    public string Subject { get; private set; } = string.Empty;
    public string Body { get; private set; } = string.Empty;
    public EmailStatus Status { get; private set; }
    public int RetryCount { get; private set; }
    public string? Error { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? SentAt { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private EmailLog() { }

    public static EmailLog Create(Guid bookingId, string recipientEmail, string subject, string body)
    {
        return new EmailLog
        {
            Id = Guid.NewGuid(),
            BookingId = bookingId,
            RecipientEmail = recipientEmail,
            Subject = subject,
            Body = body,
            Status = EmailStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void MarkSent()
    {
        Status = EmailStatus.Sent;
        SentAt = DateTime.UtcNow;
    }

    public void MarkFailed(string error)
    {
        Status = EmailStatus.Failed;
        Error = error;
        RetryCount++;
    }

    public bool CanRetry(int maxRetries = 5) => RetryCount < maxRetries;
}

public enum EmailStatus
{
    Pending = 0,
    Sent = 1,
    Failed = 2
}
