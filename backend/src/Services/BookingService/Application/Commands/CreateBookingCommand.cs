using MediatR;

namespace BookingService.Application.Commands;

public record CreateBookingCommand(
    Guid SeatId,
    string CustomerEmail,
    string CustomerName,
    decimal Amount,
    string Currency = "USD",
    string? IdempotencyKey = null) : IRequest<CreateBookingResult>;

public record CreateBookingResult(
    Guid BookingId,
    string Status);
