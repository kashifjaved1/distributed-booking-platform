using BookingPlatform.Common.Interfaces;
using NotificationService.Application.Commands;
using NotificationService.Domain.Aggregates;
using NotificationService.Infrastructure.Persistence;
using MediatR;

namespace NotificationService.Application.Handlers;

public class SendEmailHandler : IRequestHandler<SendEmailCommand, SendEmailResult>
{
    private readonly NotificationDbContext _dbContext;
    private readonly IOutboxService _outboxService;
    private readonly ILogger<SendEmailHandler> _logger;

    public SendEmailHandler(
        NotificationDbContext dbContext,
        IOutboxService outboxService,
        ILogger<SendEmailHandler> logger)
    {
        _dbContext = dbContext;
        _outboxService = outboxService;
        _logger = logger;
    }

    public async Task<SendEmailResult> Handle(SendEmailCommand request, CancellationToken cancellationToken)
    {
        try
        {
            var emailLog = EmailLog.Create(request.BookingId, request.RecipientEmail, request.Subject, request.Body);
            emailLog.MarkSent();
            _dbContext.EmailLogs.Add(emailLog);

            var emailSentEvent = new BookingPlatform.Common.Events.EmailSentEvent
            {
                NotificationId = emailLog.Id,
                BookingId = request.BookingId,
                RecipientEmail = request.RecipientEmail,
                CorrelationId = Guid.NewGuid().ToString("N")
            };

            await _outboxService.SaveEventAsync(emailSentEvent, null, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            _logger.LogInformation("Email sent to {RecipientEmail} for booking {BookingId}",
                request.RecipientEmail, request.BookingId);

            return new SendEmailResult(emailLog.Id, true);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email for booking {BookingId}", request.BookingId);

            var failedEvent = new BookingPlatform.Common.Events.EmailFailedEvent
            {
                BookingId = request.BookingId,
                RecipientEmail = request.RecipientEmail,
                FailureReason = ex.Message,
                CorrelationId = Guid.NewGuid().ToString("N")
            };

            await _outboxService.SaveEventAsync(failedEvent, null, cancellationToken);
            await _dbContext.SaveChangesAsync(cancellationToken);

            return new SendEmailResult(Guid.Empty, false);
        }
    }
}
