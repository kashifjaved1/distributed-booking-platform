using MediatR;

namespace PaymentService.Application.Commands;

public record AuthorizePaymentCommand(
    Guid BookingId,
    decimal Amount,
    string Currency = "USD") : IRequest<AuthorizePaymentResult>;

public record AuthorizePaymentResult(Guid PaymentId, bool Success, string? TransactionId = null);
