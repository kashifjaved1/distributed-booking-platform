using BookingPlatform.Common.Interfaces;
using Microsoft.EntityFrameworkCore;
using PaymentService.Application.Commands;
using PaymentService.Infrastructure.Persistence;
using MediatR;

namespace PaymentService.Application.Handlers;

public class RefundPaymentHandler : IRequestHandler<RefundPaymentCommand, RefundPaymentResult>
{
    private readonly PaymentDbContext _dbContext;
    private readonly IOutboxService _outboxService;
    private readonly ILogger<RefundPaymentHandler> _logger;

    public RefundPaymentHandler(
        PaymentDbContext dbContext,
        IOutboxService outboxService,
        ILogger<RefundPaymentHandler> logger)
    {
        _dbContext = dbContext;
        _outboxService = outboxService;
        _logger = logger;
    }

    public async Task<RefundPaymentResult> Handle(RefundPaymentCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var payment = await _dbContext.Payments
                .FirstOrDefaultAsync(p => p.BookingId == request.BookingId, cancellationToken);

            if (payment == null)
            {
                _logger.LogWarning("No payment found for booking {BookingId}", request.BookingId);
                return new RefundPaymentResult(false);
            }

            payment.Refund();

            var refundEvent = new BookingPlatform.Common.Events.PaymentRefundedEvent
            {
                PaymentId = payment.Id,
                BookingId = request.BookingId,
                Amount = payment.Amount,
                CorrelationId = Guid.NewGuid().ToString("N")
            };

            await _outboxService.SaveEventAsync(refundEvent, null, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Payment {PaymentId} refunded for booking {BookingId}", payment.Id, request.BookingId);

            return new RefundPaymentResult(true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to refund payment for booking {BookingId}", request.BookingId);
            return new RefundPaymentResult(false);
        }
    }
}
