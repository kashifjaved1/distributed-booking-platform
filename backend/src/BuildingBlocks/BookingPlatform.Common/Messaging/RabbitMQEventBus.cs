using System.Collections.Concurrent;
using System.Text;
using System.Text.Json;
using BookingPlatform.Common.Events;
using BookingPlatform.Common.Interfaces;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using RabbitMQ.Client;
using RabbitMQ.Client.Events;

namespace BookingPlatform.Common.Messaging;

public class RabbitMQEventBus : IEventBus, IAsyncDisposable
{
    private readonly IConnection _connection;
    private readonly ILogger<RabbitMQEventBus> _logger;
    private readonly ConcurrentDictionary<string, IChannel> _consumerChannels = [];
    private readonly ConcurrentDictionary<string, List<(string EventType, Type HandlerType, Func<object, Task> Handler)>> _handlers = [];
    private readonly RabbitMQOptions _options;
    private bool _disposed;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    public RabbitMQEventBus(IOptions<RabbitMQOptions> options, ILogger<RabbitMQEventBus> logger)
    {
        _options = options.Value;
        _logger = logger;

        var factory = new ConnectionFactory
        {
            HostName = _options.Host,
            Port = _options.Port,
            UserName = _options.UserName,
            Password = _options.Password,
            VirtualHost = _options.VirtualHost,
            AutomaticRecoveryEnabled = true,
            NetworkRecoveryInterval = TimeSpan.FromSeconds(5),
            RequestedHeartbeat = TimeSpan.FromSeconds(30)
        };

        _connection = factory.CreateConnectionAsync().GetAwaiter().GetResult();
        _logger.LogInformation("Connected to RabbitMQ at {Host}:{Port}", _options.Host, _options.Port);
    }

    public async Task PublishAsync<T>(T @event, CancellationToken cancellationToken = default) where T : IntegrationEvent
    {
        if (_disposed) throw new ObjectDisposedException(nameof(RabbitMQEventBus));

        await using var channel = await _connection.CreateChannelAsync();

        var exchangeName = GetExchangeName(@event);
        await channel.ExchangeDeclareAsync(exchangeName, ExchangeType.Topic, durable: true, autoDelete: false);

        var routingKey = @event.RoutingKey ?? GetRoutingKey(@event);
        // Serialize using runtime type so derived properties (BookingId, SeatId, etc.) are included
        var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(@event, @event.GetType(), JsonOptions));

        var props = new BasicProperties
        {
            Persistent = true,
            MessageId = @event.EventId.ToString("N"),
            CorrelationId = @event.CorrelationId,
            Type = @event.EventType,
            Timestamp = new AmqpTimestamp(DateTimeOffset.UtcNow.ToUnixTimeSeconds()),
            Headers = new Dictionary<string, object?>
            {
                ["x-event-type"] = @event.EventType,
                ["x-causation-id"] = @event.CausationId,
                ["x-originated-on"] = @event.OccurredOn.ToString("O")
            }
        };

        await channel.BasicPublishAsync(
            exchange: exchangeName,
            routingKey: routingKey,
            mandatory: true,
            basicProperties: props,
            body: body,
            cancellationToken: cancellationToken);

        _logger.LogDebug("Published event {EventType} with routing key {RoutingKey} to exchange {Exchange}",
            @event.EventType, routingKey, exchangeName);
    }

    public async Task SubscribeAsync<T>(string queue, string routingKey, Func<T, Task> handler, CancellationToken cancellationToken = default) where T : IntegrationEvent
    {
        if (_disposed) throw new ObjectDisposedException(nameof(RabbitMQEventBus));

        var exchangeName = GetExchangeName<T>();
        var dlqSuffix = ".dlq";
        var dlqName = queue + dlqSuffix;
        var dlxName = exchangeName + ".dlx";

        // Verify exchanges and queues exist using a temporary channel
        await using var verifyChannel = await _connection.CreateChannelAsync();
        await verifyChannel.ExchangeDeclarePassiveAsync(exchangeName);
        await verifyChannel.ExchangeDeclarePassiveAsync(dlxName);
        await verifyChannel.QueueDeclarePassiveAsync(queue);
        await verifyChannel.QueueDeclarePassiveAsync(dlqName);

        var eventTypeName = typeof(T).FullName!;
        _handlers.GetOrAdd(queue, _ => []).Add((eventTypeName, typeof(T), async msg => await handler((T)msg)));

        // Create a single consumer per queue — dispatches by message Type header
        if (!_consumerChannels.ContainsKey(queue))
        {
            var consumerChannel = await _connection.CreateChannelAsync();
            await consumerChannel.BasicQosAsync(0, _options.PrefetchCount, false);

            var typedConsumer = new AsyncEventingBasicConsumer(consumerChannel);
            typedConsumer.ReceivedAsync += async (_, ea) =>
            {
                try
                {
                    var eventType = ea.BasicProperties.Type;
                    if (eventType == null)
                    {
                        _logger.LogWarning("Received message without Type header on queue {Queue}, nacking", queue);
                        await consumerChannel.BasicNackAsync(ea.DeliveryTag, false, false);
                        return;
                    }

                    if (_handlers.TryGetValue(queue, out var queueHandlers))
                    {
                        var matchingHandler = queueHandlers.FirstOrDefault(h => h.EventType == eventType);
                        if (matchingHandler.Handler != null)
                        {
                            var retryCount = GetRetryCount(ea);
                            if (retryCount >= _options.MaxRetryAttempts)
                            {
                                await consumerChannel.BasicNackAsync(ea.DeliveryTag, false, false);
                                _logger.LogWarning("Event {EventId} exceeded max retries, routing to DLQ", ea.BasicProperties.MessageId);
                                return;
                            }

                            var json = Encoding.UTF8.GetString(ea.Body.Span);
                            var deserialized = JsonSerializer.Deserialize(json, matchingHandler.HandlerType, JsonOptions);
                            if (deserialized != null)
                            {
                                await matchingHandler.Handler(deserialized);
                                await consumerChannel.BasicAckAsync(ea.DeliveryTag, false);
                                _logger.LogDebug("Processed event {EventId} of type {EventType} on queue {Queue}", ea.BasicProperties.MessageId, eventType, queue);
                            }
                            else
                            {
                                _logger.LogError("Failed to deserialize event {EventId} as {EventType} on queue {Queue}", ea.BasicProperties.MessageId, eventType, queue);
                                await consumerChannel.BasicNackAsync(ea.DeliveryTag, false, false);
                            }
                        }
                        else
                        {
                            _logger.LogWarning("No handler found for event type {EventType} on queue {Queue}, nacking", eventType, queue);
                            await consumerChannel.BasicNackAsync(ea.DeliveryTag, false, false);
                        }
                    }
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Error processing event {EventId} on queue {Queue}", ea.BasicProperties.MessageId, queue);
                    var retryCount = GetRetryCount(ea);
                    if (retryCount < _options.MaxRetryAttempts - 1)
                    {
                        await Task.Delay(_options.RetryDelayMs * (int)Math.Pow(2, retryCount), cancellationToken);
                    }
                    await consumerChannel.BasicNackAsync(ea.DeliveryTag, false, false);
                }
            };

            await consumerChannel.BasicConsumeAsync(queue, autoAck: false, consumer: typedConsumer);
            _consumerChannels.TryAdd(queue, consumerChannel);
            _logger.LogInformation("Started consumer on queue {Queue}", queue);
        }

        _logger.LogInformation("Subscribed handler for {EventType} on queue {Queue} with routing key {RoutingKey}", typeof(T).Name, queue, routingKey);
    }

    private static int GetRetryCount(BasicDeliverEventArgs ea)
    {
        if (ea.BasicProperties.Headers != null &&
            ea.BasicProperties.Headers.TryGetValue("x-death", out var deaths) &&
            deaths is List<object> deathList && deathList.Count > 0)
        {
            return deathList.Count;
        }
        return 0;
    }

    private static string GetExchangeName<T>() where T : IntegrationEvent
    {
        var name = typeof(T).Name;
        if (name.EndsWith("Event"))
            name = name[..^5];
        if (name.EndsWith('s'))
            name = name[..^1];
        var exchangeName = name.ToLowerInvariant() switch
        {
            "bookingcreated" or "bookingconfirmed" or "bookingfailed" => "booking.exchange",
            "seatreserved" or "seatreleased" or "seatreservationfailed" => "seat.exchange",
            "paymentauthorized" or "paymentauthorizationfailed" or "paymentrefunded" => "payment.exchange",
            "ticketissued" or "ticketissuefailed" or "ticketcancelled" => "ticket.exchange",
            "emailsent" or "emailfailed" => "notification.exchange",
            _ => throw new ArgumentException($"Unknown event type: {typeof(T).Name}")
        };
        return exchangeName;
    }

    private static string GetExchangeName(IntegrationEvent @event)
    {
        var name = @event.GetType().Name;
        if (name.EndsWith("Event"))
            name = name[..^5];
        if (name.EndsWith('s'))
            name = name[..^1];
        return name.ToLowerInvariant() switch
        {
            "bookingcreated" or "bookingconfirmed" or "bookingfailed" => "booking.exchange",
            "seatreserved" or "seatreleased" or "seatreservationfailed" => "seat.exchange",
            "paymentauthorized" or "paymentauthorizationfailed" or "paymentrefunded" => "payment.exchange",
            "ticketissued" or "ticketissuefailed" or "ticketcancelled" => "ticket.exchange",
            "emailsent" or "emailfailed" => "notification.exchange",
            _ => throw new ArgumentException($"Unknown event type: {@event.GetType().Name}")
        };
    }

    private static string GetRoutingKey<T>() where T : IntegrationEvent
    {
        var name = typeof(T).Name;
        if (name.EndsWith("Event"))
            name = name[..^5];
        var parts = System.Text.RegularExpressions.Regex.Replace(name, "([a-z])([A-Z])", "$1.$2").ToLowerInvariant();
        return parts;
    }

    private static string GetRoutingKey(IntegrationEvent @event)
    {
        var name = @event.GetType().Name;
        if (name.EndsWith("Event"))
            name = name[..^5];
        var parts = System.Text.RegularExpressions.Regex.Replace(name, "([a-z])([A-Z])", "$1.$2").ToLowerInvariant();
        return parts;
    }

    public async ValueTask DisposeAsync()
    {
        if (_disposed) return;
        _disposed = true;

        foreach (var channel in _consumerChannels.Values)
        {
            try { await channel.CloseAsync(); } catch { }
            try { channel.Dispose(); } catch { }
        }
        _consumerChannels.Clear();

        try { await _connection.CloseAsync(); } catch { }
        try { _connection.Dispose(); } catch { }
    }
}
