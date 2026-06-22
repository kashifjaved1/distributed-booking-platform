using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;

namespace BookingPlatform.Common.OpenTelemetry;

public static class TelemetryConfig
{
    public const string ServiceName = "BookingPlatform";
    public const string ServiceVersion = "1.0.0";

    public static ResourceBuilder CreateResource(string serviceName)
    {
        return ResourceBuilder.CreateDefault()
            .AddService(serviceName, serviceVersion: ServiceVersion)
            .AddEnvironmentVariableDetector()
            .AddTelemetrySdk();
    }

    public static TracerProviderBuilder AddDefaultTracing(this TracerProviderBuilder builder, string serviceName)
    {
        return builder
            .SetResourceBuilder(CreateResource(serviceName))
            .AddAspNetCoreInstrumentation(options =>
            {
                options.RecordException = true;
                options.EnrichWithHttpRequest = (activity, request) =>
                {
                    var correlationId = request.HttpContext.Items["CorrelationId"]?.ToString();
                    if (correlationId != null)
                        activity.SetTag("correlation.id", correlationId);
                };
            })
            .AddEntityFrameworkCoreInstrumentation(options =>
            {
                options.SetDbStatementForText = true;
                options.SetDbStatementForStoredProcedure = true;
            })
            .AddSource("RabbitMQ", "BookingPlatform.Saga")
            .AddOtlpExporter();
    }

    public static MeterProviderBuilder AddDefaultMetrics(this MeterProviderBuilder builder, string serviceName)
    {
        return builder
            .SetResourceBuilder(CreateResource(serviceName))
            .AddAspNetCoreInstrumentation()
            .AddPrometheusExporter()
            .AddMeter("BookingPlatform.*");
    }
}
