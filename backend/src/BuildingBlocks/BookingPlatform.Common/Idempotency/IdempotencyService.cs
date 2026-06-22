using System.Collections.Concurrent;
using BookingPlatform.Common.Interfaces;
using Microsoft.Extensions.Logging;

namespace BookingPlatform.Common.Idempotency;

public class InMemoryIdempotencyService : IIdempotencyService
{
    private readonly ConcurrentDictionary<string, bool> _processed = new();
    private readonly ILogger<InMemoryIdempotencyService> _logger;

    public InMemoryIdempotencyService(ILogger<InMemoryIdempotencyService> logger)
    {
        _logger = logger;
    }

    public Task<bool> IsProcessedAsync(string idempotencyKey, CancellationToken cancellationToken = default)
    {
        var isProcessed = _processed.ContainsKey(idempotencyKey);
        if (isProcessed)
            _logger.LogDebug("Idempotency check: key {IdempotencyKey} already processed", idempotencyKey);
        return Task.FromResult(isProcessed);
    }

    public Task MarkAsProcessedAsync(string idempotencyKey, CancellationToken cancellationToken = default)
    {
        _processed.TryAdd(idempotencyKey, true);
        _logger.LogDebug("Idempotency key {IdempotencyKey} marked as processed", idempotencyKey);
        return Task.CompletedTask;
    }
}
