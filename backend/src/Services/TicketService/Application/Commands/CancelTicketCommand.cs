using MediatR;

namespace TicketService.Application.Commands;

public record CancelTicketCommand(Guid BookingId) : IRequest<CancelTicketResult>;

public record CancelTicketResult(bool Success);
