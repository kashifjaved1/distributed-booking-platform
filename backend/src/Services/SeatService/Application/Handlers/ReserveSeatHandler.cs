using BookingPlatform.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using SeatService.Application.Commands;
using SeatService.Domain.Aggregates;
using SeatService.Infrastructure.Persistence;
using MediatR;
using Microsoft.Extensions.Logging;

namespace SeatService.Application.Handlers;

public class ReserveSeatHandler : IRequestHandler<ReserveSeatCommand, ReserveSeatResult>
{
    private readonly SeatDbContext _dbContext;
    private readonly IOutboxService _outboxService;
    private readonly ILogger<ReserveSeatHandler> _logger;

    public ReserveSeatHandler(
        SeatDbContext dbContext,
        IOutboxService outboxService,
        ILogger<ReserveSeatHandler> logger)
    {
        _dbContext = dbContext;
        _outboxService = outboxService;
        _logger = logger;
    }

    public async Task<ReserveSeatResult> Handle(ReserveSeatCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var seat = await _dbContext.Seats
                .FirstOrDefaultAsync(s => s.Id == request.SeatId, cancellationToken);

            if (seat == null)
            {
                _logger.LogWarning("Seat {SeatId} not found", request.SeatId);
                await PublishFailureEvent(request.BookingId, request.SeatId, "Seat not found", cancellationToken);
                return new ReserveSeatResult(Guid.Empty, request.SeatId, false);
            }

            var reservation = seat.Reserve(request.BookingId);
            _dbContext.Reservations.Add(reservation);

            var seatReservedEvent = new BookingPlatform.Common.Events.SeatReservedEvent
            {
                ReservationId = reservation.Id,
                BookingId = request.BookingId,
                SeatId = request.SeatId,
                CorrelationId = Guid.NewGuid().ToString("N")
            };

            await _outboxService.SaveEventAsync(seatReservedEvent, null, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Seat {SeatId} reserved for booking {BookingId}", request.SeatId, request.BookingId);

            return new ReserveSeatResult(reservation.Id, request.SeatId, true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to reserve seat {SeatId} for booking {BookingId}", request.SeatId, request.BookingId);
            await PublishFailureEvent(request.BookingId, request.SeatId, ex.Message, cancellationToken);
            return new ReserveSeatResult(Guid.Empty, request.SeatId, false);
        }
    }

    private async Task PublishFailureEvent(Guid bookingId, Guid seatId, string reason, CancellationToken cancellationToken)
    {
        var failedEvent = new BookingPlatform.Common.Events.SeatReservationFailedEvent
        {
            BookingId = bookingId,
            SeatId = seatId,
            FailureReason = reason,
            CorrelationId = Guid.NewGuid().ToString("N")
        };
        await _outboxService.SaveEventAsync(failedEvent, null, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);
    }
}
