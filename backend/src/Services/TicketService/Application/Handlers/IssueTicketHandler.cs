using BookingPlatform.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using TicketService.Application.Commands;
using TicketService.Domain.Aggregates;
using TicketService.Infrastructure.Persistence;
using MediatR;

namespace TicketService.Application.Handlers;

public class IssueTicketHandler : IRequestHandler<IssueTicketCommand, IssueTicketResult>
{
    private readonly TicketDbContext _dbContext;
    private readonly IOutboxService _outboxService;
    private readonly ILogger<IssueTicketHandler> _logger;

    public IssueTicketHandler(
        TicketDbContext dbContext,
        IOutboxService outboxService,
        ILogger<IssueTicketHandler> logger)
    {
        _dbContext = dbContext;
        _outboxService = outboxService;
        _logger = logger;
    }

    public async Task<IssueTicketResult> Handle(IssueTicketCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var ticket = Ticket.Create(request.BookingId);
            ticket.Issue();
            _dbContext.Tickets.Add(ticket);

            var issuedEvent = new BookingPlatform.Common.Events.TicketIssuedEvent
            {
                TicketId = ticket.Id,
                BookingId = request.BookingId,
                TicketNumber = ticket.TicketNumber,
                CorrelationId = Guid.NewGuid().ToString("N")
            };

            await _outboxService.SaveEventAsync(issuedEvent, null, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Ticket {TicketId} ({TicketNumber}) issued for booking {BookingId}",
                ticket.Id, ticket.TicketNumber, request.BookingId);

            return new IssueTicketResult(ticket.Id, ticket.TicketNumber, true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to issue ticket for booking {BookingId}", request.BookingId);

            var failedEvent = new BookingPlatform.Common.Events.TicketIssueFailedEvent
            {
                BookingId = request.BookingId,
                FailureReason = ex.Message,
                CorrelationId = Guid.NewGuid().ToString("N")
            };

            await _outboxService.SaveEventAsync(failedEvent, null, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return new IssueTicketResult(Guid.Empty, string.Empty, false);
        }
    }
}
