namespace BookingPlatform.Common.Interfaces;

public interface IIdempotencyService
{
    Task<bool> IsProcessedAsync(string idempotencyKey, CancellationToken cancellationToken = default);
    Task MarkAsProcessedAsync(string idempotencyKey, CancellationToken cancellationToken = default);
}
