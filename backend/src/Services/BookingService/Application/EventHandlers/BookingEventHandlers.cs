using BookingPlatform.Common.Events;
using BookingPlatform.Common.Interfaces;
using BookingService.Application.Services;
using Microsoft.Extensions.Logging;

namespace BookingService.Application.EventHandlers;

public class BookingEventHandlers
{
    private readonly BookingSagaOrchestrator _saga;
    private readonly ILogger<BookingEventHandlers> _logger;

    public BookingEventHandlers(BookingSagaOrchestrator saga, ILogger<BookingEventHandlers> logger)
    {
        _saga = saga;
        _logger = logger;
    }

    public async Task HandleSeatReserved(SeatReservedEvent @event)
    {
        _logger.LogInformation("Handling SeatReserved event for booking {BookingId}", @event.BookingId);
        await _saga.HandleSeatReserved(@event.BookingId, @event.SeatId);
    }

    public async Task HandleSeatReservationFailed(SeatReservationFailedEvent @event)
    {
        _logger.LogWarning("Handling SeatReservationFailed event for booking {BookingId}: {Reason}", @event.BookingId, @event.FailureReason);
        await _saga.HandleSeatReservationFailed(@event.BookingId, @event.FailureReason);
    }

    public async Task HandlePaymentAuthorized(PaymentAuthorizedEvent @event)
    {
        _logger.LogInformation("Handling PaymentAuthorized event for booking {BookingId}", @event.BookingId);
        await _saga.HandlePaymentAuthorized(@event.BookingId);
    }

    public async Task HandlePaymentAuthorizationFailed(PaymentAuthorizationFailedEvent @event)
    {
        _logger.LogWarning("Handling PaymentAuthorizationFailed event for booking {BookingId}: {Reason}", @event.BookingId, @event.FailureReason);
        await _saga.HandlePaymentFailed(@event.BookingId, @event.FailureReason);
    }

    public async Task HandleTicketIssued(TicketIssuedEvent @event)
    {
        _logger.LogInformation("Handling TicketIssued event for booking {BookingId}", @event.BookingId);
        await _saga.HandleTicketIssued(@event.BookingId);
    }

    public async Task HandleTicketIssueFailed(TicketIssueFailedEvent @event)
    {
        _logger.LogWarning("Handling TicketIssueFailed event for booking {BookingId}: {Reason}", @event.BookingId, @event.FailureReason);
        await _saga.HandleTicketFailed(@event.BookingId, @event.FailureReason);
    }

    public async Task HandleEmailSent(EmailSentEvent @event)
    {
        _logger.LogInformation("Handling EmailSent event for booking {BookingId}", @event.BookingId);
        await _saga.HandleEmailSent(@event.BookingId);
    }

    public async Task HandleEmailFailed(EmailFailedEvent @event)
    {
        _logger.LogWarning("Handling EmailFailed event for booking {BookingId}", @event.BookingId);
        await _saga.HandleEmailFailed(@event.BookingId);
    }
}
