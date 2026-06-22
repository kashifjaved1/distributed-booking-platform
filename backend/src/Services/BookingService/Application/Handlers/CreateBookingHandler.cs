using BookingPlatform.Common.Interfaces;
using BookingService.Application.Commands;
using BookingService.Application.Services;
using BookingService.Domain.Aggregates;
using BookingService.Domain.Events;
using BookingService.Infrastructure.Persistence;
using MediatR;

namespace BookingService.Application.Handlers;

public class CreateBookingHandler : IRequestHandler<CreateBookingCommand, CreateBookingResult>
{
    private readonly BookingDbContext _dbContext;
    private readonly IOutboxService _outboxService;
    private readonly BookingSagaOrchestrator _sagaOrchestrator;
    private readonly ILogger<CreateBookingHandler> _logger;

    public CreateBookingHandler(
        BookingDbContext dbContext,
        IOutboxService outboxService,
        BookingSagaOrchestrator sagaOrchestrator,
        ILogger<CreateBookingHandler> logger)
    {
        _dbContext = dbContext;
        _outboxService = outboxService;
        _sagaOrchestrator = sagaOrchestrator;
        _logger = logger;
    }

    public async Task<CreateBookingResult> Handle(CreateBookingCommand request, CancellationToken cancellationToken)
    {
        var booking = Domain.Aggregates.Booking.Create(
            request.SeatId,
            request.CustomerEmail,
            request.CustomerName,
            request.Amount);

        _dbContext.Bookings.Add(booking);

        var sagaState = SagaState.Create(booking.Id, booking.SeatId, booking.Amount);
        _dbContext.SagaStates.Add(sagaState);

        var bookingCreatedEvent = booking.DomainEvents
            .OfType<BookingCreatedDomainEvent>()
            .First();

        var integrationEvent = new BookingPlatform.Common.Events.BookingCreatedEvent
        {
            BookingId = bookingCreatedEvent.BookingId,
            SeatId = bookingCreatedEvent.SeatId,
            CustomerEmail = bookingCreatedEvent.CustomerEmail,
            Amount = bookingCreatedEvent.Amount,
            CorrelationId = Guid.NewGuid().ToString("N")
        };

        await _outboxService.SaveEventAsync(integrationEvent, null, cancellationToken);
        await _dbContext.SaveChangesAsync(cancellationToken);

        booking.ClearDomainEvents();

        _logger.LogInformation("Booking {BookingId} created. Starting saga.", booking.Id);

        _ = _sagaOrchestrator.StartSagaAsync(booking.Id, cancellationToken);

        return new CreateBookingResult(booking.Id, booking.Status.ToString());
    }
}


