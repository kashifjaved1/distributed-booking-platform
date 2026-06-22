using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace BookingPlatform.Common.HealthChecks;

public static class HealthCheckExtensions
{
    public static IHealthChecksBuilder AddRabbitMQCheck(this IHealthChecksBuilder builder, string connectionString, string name = "rabbitmq")
    {
        return builder.Add(new HealthCheckRegistration(
            name,
            sp => new RabbitMQHealthCheck(connectionString),
            HealthStatus.Unhealthy,
            ["messaging", "rabbitmq"]));
    }
}

public class RabbitMQHealthCheck : IHealthCheck
{
    private readonly string _connectionString;

    public RabbitMQHealthCheck(string connectionString)
    {
        _connectionString = connectionString;
    }

    public async Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
    {
        try
        {
            var factory = new RabbitMQ.Client.ConnectionFactory { Uri = new Uri(_connectionString) };
            using var connection = await factory.CreateConnectionAsync();
            using var channel = await connection.CreateChannelAsync();
            return HealthCheckResult.Healthy("RabbitMQ is reachable");
        }
        catch (Exception ex)
        {
            return HealthCheckResult.Unhealthy("RabbitMQ is unreachable", ex);
        }
    }
}
