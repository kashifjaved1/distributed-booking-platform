using MediatR;

namespace SeatService.Application.Commands;

public record ReleaseSeatCommand(
    Guid SeatId,
    Guid BookingId) : IRequest<ReleaseSeatResult>;

public record ReleaseSeatResult(bool Success);
