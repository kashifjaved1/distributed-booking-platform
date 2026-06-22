using System.Diagnostics;
using BookingPlatform.Common.Events;
using BookingPlatform.Common.Interfaces;
using BookingService.Domain.Aggregates;
using BookingService.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace BookingService.Application.Services;

public class BookingSagaOrchestrator
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<BookingSagaOrchestrator> _logger;

    private static readonly ActivitySource SagaActivitySource = new("BookingPlatform.Saga");

    public BookingSagaOrchestrator(
        IServiceProvider serviceProvider,
        ILogger<BookingSagaOrchestrator> logger)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task StartSagaAsync(Guid bookingId, CancellationToken cancellationToken = default)
    {
        using var activity = SagaActivitySource.StartActivity("SagaStart");
        activity?.SetTag("booking.id", bookingId);

        _logger.LogInformation("Starting saga for booking {BookingId}", bookingId);

        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BookingDbContext>();
        var eventBus = scope.ServiceProvider.GetRequiredService<IEventBus>();

        var saga = await dbContext.SagaStates.FirstOrDefaultAsync(s => s.BookingId == bookingId, cancellationToken);
        if (saga == null)
        {
            _logger.LogError("Saga state not found for booking {BookingId}", bookingId);
            return;
        }

        var booking = await dbContext.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);
        if (booking == null)
        {
            _logger.LogError("Booking {BookingId} not found", bookingId);
            return;
        }

        try
        {
            await ReserveSeatStep(booking, saga, eventBus, cancellationToken);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Saga failed for booking {BookingId} at step {Step}", bookingId, saga.CurrentStep);
            await HandleSagaFailure(booking, saga, ex.Message, scope, cancellationToken);
        }
    }

    private async Task ReserveSeatStep(Domain.Aggregates.Booking booking, SagaState saga, IEventBus eventBus, CancellationToken cancellationToken)
    {
        using var activity = SagaActivitySource.StartActivity("ReserveSeat");
        activity?.SetTag("booking.id", booking.Id);
        activity?.SetTag("seat.id", booking.SeatId);

        _logger.LogInformation("Step 1/4: Reserving seat {SeatId} for booking {BookingId}", booking.SeatId, booking.Id);

        var @event = new SeatReservedEvent
        {
            BookingId = booking.Id,
            SeatId = booking.SeatId,
            CorrelationId = Guid.NewGuid().ToString("N"),
            ReservationId = Guid.NewGuid(),
            RoutingKey = "seat.reserve.command"
        };

        await eventBus.PublishAsync(@event, cancellationToken);
        saga.AdvanceTo(SagaStep.AuthorizePayment);

        _logger.LogInformation("Seat reservation requested for booking {BookingId}", booking.Id);
    }

    public async Task HandleSeatReserved(Guid bookingId, Guid seatId, CancellationToken cancellationToken = default)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BookingDbContext>();
        var eventBus = scope.ServiceProvider.GetRequiredService<IEventBus>();
        var outbox = scope.ServiceProvider.GetRequiredService<IOutboxService>();

        var saga = await dbContext.SagaStates.FirstOrDefaultAsync(s => s.BookingId == bookingId, cancellationToken);
        var booking = await dbContext.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);

        if (saga == null || booking == null)
        {
            _logger.LogWarning("Booking {BookingId} not found for seat reserved handling", bookingId);
            return;
        }

        booking.MarkSeatReserved();
        saga.AdvanceTo(SagaStep.AuthorizePayment);

        _logger.LogInformation("Step 2/4: Authorizing payment for booking {BookingId}", bookingId);

        var @event = new PaymentAuthorizedEvent
        {
            BookingId = booking.Id,
            Amount = booking.Amount,
            PaymentId = Guid.NewGuid(),
            CorrelationId = Guid.NewGuid().ToString("N"),
            RoutingKey = "payment.authorize.command"
        };

        await outbox.SaveEventAsync(@event, null, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task HandleSeatReservationFailed(Guid bookingId, string reason, CancellationToken cancellationToken = default)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BookingDbContext>();

        var booking = await dbContext.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);
        var saga = await dbContext.SagaStates.FirstOrDefaultAsync(s => s.BookingId == bookingId, cancellationToken);

        if (booking != null)
        {
            booking.Fail($"Seat reservation failed: {reason}");
            saga?.Fail(reason);
            await dbContext.SaveChangesAsync(cancellationToken);
        }

        await PublishBookingFailed(bookingId, reason, "ReserveSeat", cancellationToken);
    }

    public async Task HandlePaymentAuthorized(Guid bookingId, CancellationToken cancellationToken = default)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BookingDbContext>();
        var outbox = scope.ServiceProvider.GetRequiredService<IOutboxService>();

        var booking = await dbContext.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);
        var saga = await dbContext.SagaStates.FirstOrDefaultAsync(s => s.BookingId == bookingId, cancellationToken);

        if (booking == null || saga == null)
        {
            _logger.LogWarning("Booking {BookingId} not found for payment authorized handling", bookingId);
            return;
        }

        booking.MarkPaymentAuthorized();

        _logger.LogInformation("Step 3/4: Issuing ticket for booking {BookingId}", bookingId);

        var @event = new TicketIssuedEvent
        {
            BookingId = booking.Id,
            TicketId = Guid.NewGuid(),
            CorrelationId = Guid.NewGuid().ToString("N"),
            RoutingKey = "ticket.issue.command"
        };

        saga.AdvanceTo(SagaStep.IssueTicket);
        await outbox.SaveEventAsync(@event, null, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task HandlePaymentFailed(Guid bookingId, string reason, CancellationToken cancellationToken = default)
    {
        _logger.LogWarning("Payment failed for booking {BookingId}. Starting compensation: releasing seat.", bookingId);

        using var scope = _serviceProvider.CreateScope();
        var eventBus = scope.ServiceProvider.GetRequiredService<IEventBus>();

        var releaseEvent = new SeatReleasedEvent
        {
            BookingId = bookingId,
            SeatId = Guid.Empty,
            ReservationId = Guid.NewGuid(),
            CorrelationId = Guid.NewGuid().ToString("N")
        };

        await eventBus.PublishAsync(releaseEvent, cancellationToken);

        await HandleSagaFailure(bookingId, $"Payment failed: {reason}", "AuthorizePayment", cancellationToken);
    }

    public async Task HandleTicketIssued(Guid bookingId, CancellationToken cancellationToken = default)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BookingDbContext>();
        var outbox = scope.ServiceProvider.GetRequiredService<IOutboxService>();

        var booking = await dbContext.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);
        var saga = await dbContext.SagaStates.FirstOrDefaultAsync(s => s.BookingId == bookingId, cancellationToken);

        if (booking == null || saga == null)
        {
            _logger.LogWarning("Booking {BookingId} not found for ticket issued handling", bookingId);
            return;
        }

        booking.MarkTicketIssued();
        booking.MarkEmailPending();

        _logger.LogInformation("Step 4/4: Sending confirmation email for booking {BookingId}", bookingId);

        var emailEvent = new EmailSentEvent
        {
            BookingId = booking.Id,
            RecipientEmail = booking.CustomerEmail,
            NotificationId = Guid.NewGuid(),
            CorrelationId = Guid.NewGuid().ToString("N"),
            RoutingKey = "email.send.command"
        };

        saga.AdvanceTo(SagaStep.SendEmail);
        await outbox.SaveEventAsync(emailEvent, null, cancellationToken);
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    public async Task HandleTicketFailed(Guid bookingId, string reason, CancellationToken cancellationToken = default)
    {
        _logger.LogWarning("Ticket failed for booking {BookingId}. Starting compensation: refund payment + release seat.", bookingId);

        using var scope = _serviceProvider.CreateScope();
        var eventBus = scope.ServiceProvider.GetRequiredService<IEventBus>();

        var refundEvent = new PaymentRefundedEvent
        {
            BookingId = bookingId,
            PaymentId = Guid.NewGuid(),
            Amount = 0,
            CorrelationId = Guid.NewGuid().ToString("N")
        };

        await eventBus.PublishAsync(refundEvent, cancellationToken);

        var releaseEvent = new SeatReleasedEvent
        {
            BookingId = bookingId,
            SeatId = Guid.Empty,
            ReservationId = Guid.NewGuid(),
            CorrelationId = Guid.NewGuid().ToString("N")
        };

        await eventBus.PublishAsync(releaseEvent, cancellationToken);

        await HandleSagaFailure(bookingId, $"Ticket failed: {reason}", "IssueTicket", cancellationToken);
    }

    public async Task HandleEmailSent(Guid bookingId, CancellationToken cancellationToken = default)
    {
        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BookingDbContext>();

        var booking = await dbContext.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);
        var saga = await dbContext.SagaStates.FirstOrDefaultAsync(s => s.BookingId == bookingId, cancellationToken);

        if (booking == null || saga == null)
        {
            _logger.LogWarning("Booking {BookingId} not found for email sent handling", bookingId);
            return;
        }

        booking.Confirm();
        saga.AdvanceTo(SagaStep.Completed);
        saga.Complete();
        await dbContext.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Booking {BookingId} saga completed successfully!", bookingId);
    }

    public async Task HandleEmailFailed(Guid bookingId, CancellationToken cancellationToken = default)
    {
        _logger.LogWarning("Email failed for booking {BookingId}. Booking remains successful, will retry email.", bookingId);

        using var scope = _serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<BookingDbContext>();

        var booking = await dbContext.Bookings.FirstOrDefaultAsync(b => b.Id == bookingId, cancellationToken);
        var saga = await dbContext.SagaStates.FirstOrDefaultAsync(s => s.BookingId == bookingId, cancellationToken);

        if (booking != null) booking.MarkEmailPending();
        if (saga != null) saga.Complete();
        await dbContext.SaveChangesAsync(cancellationToken);
    }

    private async Task HandleSagaFailure(Guid bookingId, string reason, string failedStep, CancellationToken cancellationToken)
    {
        await PublishBookingFailed(bookingId, reason, failedStep, cancellationToken);
    }

    private async Task HandleSagaFailure(Domain.Aggregates.Booking booking, SagaState saga, string reason, IServiceScope scope, CancellationToken cancellationToken)
    {
        booking.Fail(reason);
        saga.Fail(reason);
        var dbContext = scope.ServiceProvider.GetRequiredService<BookingDbContext>();
        await dbContext.SaveChangesAsync(cancellationToken);

        await PublishBookingFailed(booking.Id, reason, saga.CurrentStep.ToString(), cancellationToken);
    }

    private async Task PublishBookingFailed(Guid bookingId, string reason, string failedStep, CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var outbox = scope.ServiceProvider.GetRequiredService<IOutboxService>();

        var @event = new BookingFailedEvent
        {
            BookingId = bookingId,
            FailureReason = reason,
            FailedStep = failedStep,
            CorrelationId = Guid.NewGuid().ToString("N")
        };

        await outbox.SaveEventAsync(@event, null, cancellationToken);
    }
}
