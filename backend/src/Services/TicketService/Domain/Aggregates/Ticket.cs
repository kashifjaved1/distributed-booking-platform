namespace TicketService.Domain.Aggregates;

public class Ticket
{
    public Guid Id { get; private set; }
    public Guid BookingId { get; private set; }
    public string TicketNumber { get; private set; } = string.Empty;
    public TicketStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? IssuedAt { get; private set; }
    public DateTime? CancelledAt { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private Ticket() { }

    public static Ticket Create(Guid bookingId)
    {
        return new Ticket
        {
            Id = Guid.NewGuid(),
            BookingId = bookingId,
            TicketNumber = GenerateTicketNumber(),
            Status = TicketStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };
    }

    public void Issue()
    {
        if (Status != TicketStatus.Pending)
            throw new InvalidOperationException($"Cannot issue ticket in status {Status}");

        Status = TicketStatus.Issued;
        IssuedAt = DateTime.UtcNow;
    }

    public void Cancel()
    {
        if (Status != TicketStatus.Issued)
            throw new InvalidOperationException($"Cannot cancel ticket in status {Status}");

        Status = TicketStatus.Cancelled;
        CancelledAt = DateTime.UtcNow;
    }

    public void FailIssue(string reason)
    {
        Status = TicketStatus.Failed;
    }

    private static string GenerateTicketNumber()
    {
        var timestamp = DateTime.UtcNow.ToString("yyyyMMdd");
        var random = Random.Shared.Next(100000, 999999);
        return $"TKT-{timestamp}-{random}";
    }
}

public enum TicketStatus
{
    Pending = 0,
    Issued = 1,
    Cancelled = 2,
    Failed = 3
}
