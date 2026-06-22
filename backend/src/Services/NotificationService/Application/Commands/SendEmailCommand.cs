using MediatR;

namespace NotificationService.Application.Commands;

public record SendEmailCommand(
    Guid BookingId,
    string RecipientEmail,
    string Subject,
    string Body) : IRequest<SendEmailResult>;

public record SendEmailResult(Guid NotificationId, bool Success);
