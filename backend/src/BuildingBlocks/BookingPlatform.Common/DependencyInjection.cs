using BookingPlatform.Common.Idempotency;
using BookingPlatform.Common.Interfaces;
using BookingPlatform.Common.Messaging;
using BookingPlatform.Common.Outbox;
using Microsoft.Extensions.DependencyInjection;

namespace BookingPlatform.Common;

public static class DependencyInjection
{
    public static IServiceCollection AddBookingPlatformCommon(this IServiceCollection services)
    {
        services.AddScoped<IIdempotencyService, InMemoryIdempotencyService>();
        services.AddSingleton<ICorrelationService, CorrelationService>();

        return services;
    }

    public static IServiceCollection AddRabbitMQ(this IServiceCollection services, string exchangeName)
    {
        services.AddOptions<RabbitMQOptions>()
            .BindConfiguration($"RabbitMQ:{exchangeName}");

        services.AddSingleton<IEventBus, RabbitMQEventBus>();

        return services;
    }

    public static IServiceCollection AddOutbox(this IServiceCollection services)
    {
        services.AddOptions<OutboxOptions>()
            .BindConfiguration("Outbox");

        services.AddHostedService<OutboxPublisherService>();

        return services;
    }
}

internal class CorrelationService : ICorrelationService
{
    private readonly System.Threading.AsyncLocal<string?> _correlationId = new();

    public string GetCorrelationId()
    {
        return _correlationId.Value ??= Guid.NewGuid().ToString("N");
    }

    public void SetCorrelationId(string correlationId)
    {
        _correlationId.Value = correlationId;
    }
}
