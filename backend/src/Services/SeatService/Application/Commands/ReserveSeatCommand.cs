using MediatR;

namespace SeatService.Application.Commands;

public record ReserveSeatCommand(
    Guid SeatId,
    Guid BookingId) : IRequest<ReserveSeatResult>;

public record ReserveSeatResult(Guid ReservationId, Guid SeatId, bool Success);
