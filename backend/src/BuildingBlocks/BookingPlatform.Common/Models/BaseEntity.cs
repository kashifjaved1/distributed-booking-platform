namespace BookingPlatform.Common.Models;

public abstract class BaseEntity<TId> where TId : notnull
{
    public TId Id { get; protected set; } = default!;
    public DateTime CreatedAt { get; protected set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; protected set; }
    public byte[] RowVersion { get; protected set; } = [];

    private readonly List<object> _domainEvents = [];
    public IReadOnlyCollection<object> DomainEvents => _domainEvents.AsReadOnly();

    protected void AddDomainEvent(object domainEvent)
    {
        _domainEvents.Add(domainEvent);
    }

    public void ClearDomainEvents()
    {
        _domainEvents.Clear();
    }

    protected void SetUpdated()
    {
        UpdatedAt = DateTime.UtcNow;
    }
}

public abstract class AggregateRoot<TId> : BaseEntity<TId> where TId : notnull
{
    protected AggregateRoot() { }

    protected AggregateRoot(TId id)
    {
        Id = id;
    }
}
