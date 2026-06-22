using System.Text.Json;
using BookingPlatform.Common.Events;
using BookingPlatform.Common.Interfaces;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace BookingPlatform.Common.Outbox;

public class OutboxPublisherService : BackgroundService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<OutboxPublisherService> _logger;
    private readonly OutboxOptions _options;

    public OutboxPublisherService(
        IServiceScopeFactory scopeFactory,
        ILogger<OutboxPublisherService> logger,
        IOptions<OutboxOptions> options)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Outbox Publisher started with polling interval {PollingIntervalMs}ms", _options.PollingIntervalMs);

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var outboxService = scope.ServiceProvider.GetRequiredService<IOutboxService>();
                var eventBus = scope.ServiceProvider.GetRequiredService<IEventBus>();

                var pendingEvents = await outboxService.GetPendingEventsAsync(_options.BatchSize, stoppingToken);

                foreach (var outboxMessage in pendingEvents)
                {
                    try
                    {
                        outboxMessage.Status = OutboxStatus.Processing;
                        outboxMessage.LastAttemptOn = DateTime.UtcNow;

                        var eventType = Type.GetType(outboxMessage.EventType);
                        if (eventType == null)
                        {
                            _logger.LogWarning("Could not resolve event type {EventType}", outboxMessage.EventType);
                            await outboxService.MarkAsFailedAsync(outboxMessage.Id, "Unknown event type", stoppingToken);
                            continue;
                        }

                        var integrationEvent = JsonSerializer.Deserialize(outboxMessage.Payload, eventType, JsonOptions) as IntegrationEvent;
                        if (integrationEvent == null)
                        {
                            await outboxService.MarkAsFailedAsync(outboxMessage.Id, "Deserialization failed", stoppingToken);
                            continue;
                        }

                        // Use stored routing key override if available
                        if (!string.IsNullOrEmpty(outboxMessage.RoutingKey))
                        {
                            integrationEvent.RoutingKey = outboxMessage.RoutingKey;
                        }

                        // Use runtime type so PublishAsync serializes all derived properties
                        await ((dynamic)eventBus).PublishAsync((dynamic)integrationEvent, stoppingToken);
                        await outboxService.MarkAsProcessedAsync(outboxMessage.Id, stoppingToken);

                        _logger.LogDebug("Published outbox event {EventId} of type {EventType}", outboxMessage.Id, outboxMessage.EventType);
                    }
                    catch (Exception ex)
                    {
                        _logger.LogError(ex, "Failed to publish outbox event {EventId}", outboxMessage.Id);
                        outboxMessage.RetryCount++;
                        if (outboxMessage.RetryCount >= _options.MaxRetryCount)
                        {
                            await outboxService.MarkAsFailedAsync(outboxMessage.Id, ex.Message, stoppingToken);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error in outbox publisher loop");
            }

            await Task.Delay(_options.PollingIntervalMs, stoppingToken);
        }
    }
}

public class OutboxOptions
{
    public int PollingIntervalMs { get; set; } = 1000;
    public int BatchSize { get; set; } = 50;
    public int MaxRetryCount { get; set; } = 5;
}
