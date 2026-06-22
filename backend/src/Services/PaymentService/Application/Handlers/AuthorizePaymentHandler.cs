using BookingPlatform.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using PaymentService.Application.Commands;
using PaymentService.Domain.Aggregates;
using PaymentService.Infrastructure.Persistence;
using MediatR;

namespace PaymentService.Application.Handlers;

public class AuthorizePaymentHandler : IRequestHandler<AuthorizePaymentCommand, AuthorizePaymentResult>
{
    private readonly PaymentDbContext _dbContext;
    private readonly IOutboxService _outboxService;
    private readonly ILogger<AuthorizePaymentHandler> _logger;

    public AuthorizePaymentHandler(
        PaymentDbContext dbContext,
        IOutboxService outboxService,
        ILogger<AuthorizePaymentHandler> logger)
    {
        _dbContext = dbContext;
        _outboxService = outboxService;
        _logger = logger;
    }

    public async Task<AuthorizePaymentResult> Handle(AuthorizePaymentCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var payment = Payment.Create(request.BookingId, request.Amount, request.Currency);
            var transactionId = $"TXN-{Guid.NewGuid():N}"[..20];

            payment.Authorize(transactionId);
            _dbContext.Payments.Add(payment);

            var authorizedEvent = new BookingPlatform.Common.Events.PaymentAuthorizedEvent
            {
                PaymentId = payment.Id,
                BookingId = request.BookingId,
                Amount = request.Amount,
                CorrelationId = Guid.NewGuid().ToString("N")
            };

            await _outboxService.SaveEventAsync(authorizedEvent, null, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Payment {PaymentId} authorized for booking {BookingId}", payment.Id, request.BookingId);

            return new AuthorizePaymentResult(payment.Id, true, transactionId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to authorize payment for booking {BookingId}", request.BookingId);

            var failedEvent = new BookingPlatform.Common.Events.PaymentAuthorizationFailedEvent
            {
                BookingId = request.BookingId,
                Amount = request.Amount,
                FailureReason = ex.Message,
                CorrelationId = Guid.NewGuid().ToString("N")
            };

            await _outboxService.SaveEventAsync(failedEvent, null, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return new AuthorizePaymentResult(Guid.Empty, false);
        }
    }
}
