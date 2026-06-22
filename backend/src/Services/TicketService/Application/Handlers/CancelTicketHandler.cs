using BookingPlatform.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using TicketService.Application.Commands;
using TicketService.Infrastructure.Persistence;
using MediatR;

namespace TicketService.Application.Handlers;

public class CancelTicketHandler : IRequestHandler<CancelTicketCommand, CancelTicketResult>
{
    private readonly TicketDbContext _dbContext;
    private readonly IOutboxService _outboxService;
    private readonly ILogger<CancelTicketHandler> _logger;

    public CancelTicketHandler(
        TicketDbContext dbContext,
        IOutboxService outboxService,
        ILogger<CancelTicketHandler> logger)
    {
        _dbContext = dbContext;
        _outboxService = outboxService;
        _logger = logger;
    }

    public async Task<CancelTicketResult> Handle(CancelTicketCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var ticket = await _dbContext.Tickets
                .FirstOrDefaultAsync(t => t.BookingId == request.BookingId, cancellationToken);

            if (ticket == null)
            {
                _logger.LogWarning("No ticket found for booking {BookingId}", request.BookingId);
                return new CancelTicketResult(false);
            }

            ticket.Cancel();

            var cancelledEvent = new BookingPlatform.Common.Events.TicketCancelledEvent
            {
                TicketId = ticket.Id,
                BookingId = request.BookingId,
                CorrelationId = Guid.NewGuid().ToString("N")
            };

            await _outboxService.SaveEventAsync(cancelledEvent, null, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Ticket {TicketId} cancelled for booking {BookingId}", ticket.Id, request.BookingId);

            return new CancelTicketResult(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to cancel ticket for booking {BookingId}", request.BookingId);
            return new CancelTicketResult(false);
        }
    }
}
