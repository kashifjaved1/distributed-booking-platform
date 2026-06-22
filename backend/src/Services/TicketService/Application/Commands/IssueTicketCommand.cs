using MediatR;

namespace TicketService.Application.Commands;

public record IssueTicketCommand(Guid BookingId) : IRequest<IssueTicketResult>;

public record IssueTicketResult(Guid TicketId, string TicketNumber, bool Success);
