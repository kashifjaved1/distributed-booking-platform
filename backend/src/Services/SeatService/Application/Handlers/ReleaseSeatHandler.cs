using BookingPlatform.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using SeatService.Application.Commands;
using SeatService.Domain.Aggregates;
using SeatService.Infrastructure.Persistence;
using MediatR;
using Microsoft.Extensions.Logging;

namespace SeatService.Application.Handlers;

public class ReleaseSeatHandler : IRequestHandler<ReleaseSeatCommand, ReleaseSeatResult>
{
    private readonly SeatDbContext _dbContext;
    private readonly IOutboxService _outboxService;
    private readonly ILogger<ReleaseSeatHandler> _logger;

    public ReleaseSeatHandler(
        SeatDbContext dbContext,
        IOutboxService outboxService,
        ILogger<ReleaseSeatHandler> logger)
    {
        _dbContext = dbContext;
        _outboxService = outboxService;
        _logger = logger;
    }

    public async Task<ReleaseSeatResult> Handle(ReleaseSeatCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var seat = await _dbContext.Seats
                .FirstOrDefaultAsync(s => s.Id == request.SeatId, cancellationToken);

            if (seat == null)
            {
                _logger.LogWarning("Seat {SeatId} not found for release", request.SeatId);
                return new ReleaseSeatResult(false);
            }

            var reservation = await _dbContext.Reservations
                .FirstOrDefaultAsync(r => r.BookingId == request.BookingId && r.Status == ReservationStatus.Active,
                    cancellationToken);

            seat.Release();
            reservation?.Release();

            var releasedEvent = new BookingPlatform.Common.Events.SeatReleasedEvent
            {
                BookingId = request.BookingId,
                SeatId = request.SeatId,
                ReservationId = reservation?.Id ?? Guid.Empty,
                CorrelationId = Guid.NewGuid().ToString("N")
            };

            await _outboxService.SaveEventAsync(releasedEvent, null, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Seat {SeatId} released for booking {BookingId}", request.SeatId, request.BookingId);

            return new ReleaseSeatResult(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to release seat {SeatId} for booking {BookingId}", request.SeatId, request.BookingId);
            return new ReleaseSeatResult(false);
        }
    }
}
