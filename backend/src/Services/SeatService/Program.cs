using BookingPlatform.Common;
using BookingPlatform.Common.Interfaces;
using BookingPlatform.Common.Middleware;
using BookingPlatform.Common.Outbox;
using Microsoft.EntityFrameworkCore;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using SeatService.Domain.Aggregates;
using SeatService.Infrastructure.Messaging;
using SeatService.Infrastructure.Outbox;
using SeatService.Infrastructure.Persistence;
using System.Reflection;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddBookingPlatformCommon();
builder.Services.AddRabbitMQ("seat");
builder.Services.AddOutbox();

builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));

builder.Services.AddDbContext<SeatDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("SeatDB"),
        npgsqlOptions => npgsqlOptions.EnableRetryOnFailure(3)));

builder.Services.AddScoped<IOutboxService, SeatOutboxService>();
builder.Services.AddSingleton<SeatEventConsumer>();

builder.Services.AddHealthChecks();

var serviceName = "SeatService";
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService(serviceName))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddEntityFrameworkCoreInstrumentation()
        .AddOtlpExporter());

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<SeatDbContext>();
    await db.Database.EnsureDeletedAsync();
    await db.Database.EnsureCreatedAsync();

    if (!await db.Seats.AnyAsync())
    {
        db.Seats.AddRange(
            Seat.Create("A1", "Orchestra", 150.00m),
            Seat.Create("A2", "Orchestra", 150.00m),
            Seat.Create("B1", "Balcony", 100.00m),
            Seat.Create("B2", "Balcony", 100.00m));
        await db.SaveChangesAsync();
    }
}

var consumer = app.Services.GetRequiredService<SeatEventConsumer>();
_ = consumer.StartAsync();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<ExceptionMiddleware>();
app.MapControllers();
app.MapHealthChecks("/health");

await app.RunAsync();
