using BookingService.Domain.Events;

namespace BookingService.Domain.Aggregates;

public class Booking
{
    public Guid Id { get; private set; }
    public Guid SeatId { get; private set; }
    public string CustomerEmail { get; private set; } = string.Empty;
    public string CustomerName { get; private set; } = string.Empty;
    public decimal Amount { get; private set; }
    public BookingStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private readonly List<BookingDomainEvent> _domainEvents = [];
    public IReadOnlyCollection<BookingDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    private Booking() { }

    public static Booking Create(Guid seatId, string customerEmail, string customerName, decimal amount)
    {
        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            SeatId = seatId,
            CustomerEmail = customerEmail,
            CustomerName = customerName,
            Amount = amount,
            Status = BookingStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        booking._domainEvents.Add(new BookingCreatedDomainEvent(
            booking.Id, booking.SeatId, booking.CustomerEmail, booking.CustomerName, booking.Amount));

        return booking;
    }

    public void Confirm()
    {
        if (Status != BookingStatus.Pending && Status != BookingStatus.EmailPending)
            throw new InvalidOperationException($"Cannot confirm booking in status {Status}");

        Status = BookingStatus.Confirmed;
        UpdatedAt = DateTime.UtcNow;
        _domainEvents.Add(new BookingConfirmedDomainEvent(Id));
    }

    public void Fail(string reason)
    {
        Status = BookingStatus.Failed;
        UpdatedAt = DateTime.UtcNow;
        _domainEvents.Add(new BookingFailedDomainEvent(Id, reason));
    }

    public void MarkSeatReserved()
    {
        if (Status != BookingStatus.Pending)
            throw new InvalidOperationException($"Cannot mark seat reserved in status {Status}");
        Status = BookingStatus.SeatReserved;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkPaymentAuthorized()
    {
        if (Status != BookingStatus.SeatReserved)
            throw new InvalidOperationException($"Cannot mark payment authorized in status {Status}");
        Status = BookingStatus.PaymentAuthorized;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkTicketIssued()
    {
        if (Status != BookingStatus.PaymentAuthorized)
            throw new InvalidOperationException($"Cannot mark ticket issued in status {Status}");
        Status = BookingStatus.TicketIssued;
        UpdatedAt = DateTime.UtcNow;
    }

    public void MarkEmailPending()
    {
        if (Status != BookingStatus.TicketIssued)
            throw new InvalidOperationException($"Cannot mark email pending in status {Status}");
        Status = BookingStatus.EmailPending;
        UpdatedAt = DateTime.UtcNow;
    }

    public void ClearDomainEvents()
    {
        _domainEvents.Clear();
    }
}

public enum BookingStatus
{
    Pending = 0,
    SeatReserved = 1,
    PaymentAuthorized = 2,
    TicketIssued = 3,
    EmailPending = 4,
    Confirmed = 5,
    Failed = 6,
    Compensating = 7
}
