namespace BookingPlatform.Common.Messaging;

public class RabbitMQOptions
{
    public string Host { get; set; } = "localhost";
    public int Port { get; set; } = 5672;
    public string UserName { get; set; } = "guest";
    public string Password { get; set; } = "guest";
    public string VirtualHost { get; set; } = "/";
    public int RetryDelayMs { get; set; } = 1000;
    public int MaxRetryAttempts { get; set; } = 5;
    public ushort PrefetchCount { get; set; } = 10;
    public string ExchangeName { get; set; } = string.Empty;
    public string QueueName { get; set; } = string.Empty;
    public string DeadLetterExchange { get; set; } = string.Empty;
    public string DeadLetterQueue { get; set; } = string.Empty;
    public bool UseDeadLetter { get; set; } = true;
}
