namespace BookingPlatform.Common.Models;

public class CorrelationId : ValueObject
{
    public Guid Value { get; }

    public CorrelationId()
    {
        Value = Guid.NewGuid();
    }

    public CorrelationId(Guid value)
    {
        Value = value;
    }

    public CorrelationId(string value)
    {
        Value = Guid.Parse(value);
    }

    protected override IEnumerable<object> GetEqualityComponents()
    {
        yield return Value;
    }

    public override string ToString() => Value.ToString("N");
}
