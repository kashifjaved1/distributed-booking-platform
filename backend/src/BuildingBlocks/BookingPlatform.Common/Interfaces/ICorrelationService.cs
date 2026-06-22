namespace BookingPlatform.Common.Interfaces;

public interface ICorrelationService
{
    string GetCorrelationId();
    void SetCorrelationId(string correlationId);
}
