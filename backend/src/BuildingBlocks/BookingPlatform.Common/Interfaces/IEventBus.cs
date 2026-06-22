using BookingPlatform.Common.Events;

namespace BookingPlatform.Common.Interfaces;

public interface IEventBus
{
    Task PublishAsync<T>(T @event, CancellationToken cancellationToken = default) where T : IntegrationEvent;
    Task SubscribeAsync<T>(string queue, string routingKey, Func<T, Task> handler, CancellationToken cancellationToken = default) where T : IntegrationEvent;
}
