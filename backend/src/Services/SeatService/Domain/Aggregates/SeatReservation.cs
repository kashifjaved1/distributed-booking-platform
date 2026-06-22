namespace SeatService.Domain.Aggregates;

public class SeatReservation
{
    public Guid Id { get; private set; }
    public Guid SeatId { get; private set; }
    public Guid BookingId { get; private set; }
    public ReservationStatus Status { get; private set; }
    public DateTime ReservedAt { get; private set; }
    public DateTime? ReleasedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = [];

    private SeatReservation() { }

    public static SeatReservation Create(Guid seatId, Guid bookingId)
    {
        return new SeatReservation
        {
            Id = Guid.NewGuid(),
            SeatId = seatId,
            BookingId = bookingId,
            Status = ReservationStatus.Active,
            ReservedAt = DateTime.UtcNow
        };
    }

    public void Release()
    {
        Status = ReservationStatus.Released;
        ReleasedAt = DateTime.UtcNow;
    }
}

public enum ReservationStatus
{
    Active = 0,
    Released = 1
}
