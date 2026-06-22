using MediatR;

namespace PaymentService.Application.Commands;

public record RefundPaymentCommand(Guid BookingId) : IRequest<RefundPaymentResult>;

public record RefundPaymentResult(bool Success);
