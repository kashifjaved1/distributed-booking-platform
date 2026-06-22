namespace SeatService.Domain.Aggregates;

public class Seat
{
    public Guid Id { get; private set; }
    public string SeatNumber { get; private set; } = string.Empty;
    public string Section { get; private set; } = string.Empty;
    public decimal Price { get; private set; }
    public SeatStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public DateTime? UpdatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private Seat() { }

    public static Seat Create(string seatNumber, string section, decimal price)
    {
        return new Seat
        {
            Id = Guid.NewGuid(),
            SeatNumber = seatNumber,
            Section = section,
            Price = price,
            Status = SeatStatus.Available,
            CreatedAt = DateTime.UtcNow
        };
    }

    public SeatReservation Reserve(Guid bookingId)
    {
        if (Status != SeatStatus.Available)
            throw new InvalidOperationException($"Seat {Id} is not available (current status: {Status})");

        Status = SeatStatus.Reserved;
        UpdatedAt = DateTime.UtcNow;

        return SeatReservation.Create(Id, bookingId);
    }

    public void Release()
    {
        if (Status != SeatStatus.Reserved)
            throw new InvalidOperationException($"Seat {Id} is not reserved (current status: {Status})");

        Status = SeatStatus.Available;
        UpdatedAt = DateTime.UtcNow;
    }
}

public enum SeatStatus
{
    Available = 0,
    Reserved = 1,
    Maintenance = 2
}
