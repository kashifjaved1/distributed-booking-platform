using System.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace BookingPlatform.Common.Middleware;

public class CorrelationIdMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<CorrelationIdMiddleware> _logger;

    public CorrelationIdMiddleware(RequestDelegate next, ILogger<CorrelationIdMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        const string correlationIdHeader = "X-Correlation-Id";

        if (!context.Request.Headers.TryGetValue(correlationIdHeader, out var correlationId))
        {
            correlationId = Guid.NewGuid().ToString("N");
            context.Request.Headers.Append(correlationIdHeader, correlationId);
        }

        context.Response.Headers.Append(correlationIdHeader, correlationId);

        using (var scope = _logger.BeginScope(new Dictionary<string, object> { ["CorrelationId"] = correlationId }))
        {
            Activity.Current?.SetTag("correlation.id", correlationId);

            context.Items["CorrelationId"] = correlationId.ToString();

            await _next(context);
        }
    }
}

public static class CorrelationIdExtensions
{
    public static string GetCorrelationId(this HttpContext context)
    {
        return context.Items["CorrelationId"] as string ?? Guid.NewGuid().ToString("N");
    }
}
