using BookingPlatform.Common;
using BookingPlatform.Common.Interfaces;
using BookingPlatform.Common.Middleware;
using BookingPlatform.Common.Outbox;
using BookingService.Application.EventHandlers;
using BookingService.Application.Services;
using BookingService.Infrastructure.Messaging;
using BookingService.Infrastructure.Outbox;
using BookingService.Infrastructure.Persistence;
using MediatR;
using Microsoft.EntityFrameworkCore;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using System.Reflection;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddBookingPlatformCommon();
builder.Services.AddRabbitMQ("booking");
builder.Services.AddOutbox();

builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));

builder.Services.AddDbContext<BookingDbContext>(options =>
    options.UseNpgsql(
        builder.Configuration.GetConnectionString("BookingDB"),
        npgsqlOptions => npgsqlOptions.EnableRetryOnFailure(3)));

builder.Services.AddScoped<IOutboxService, BookingOutboxService>();
builder.Services.AddScoped<BookingSagaOrchestrator>();
builder.Services.AddScoped<BookingEventHandlers>();
builder.Services.AddScoped<BookingEventConsumer>();

builder.Services.AddHealthChecks();

var serviceName = "BookingService";
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService(serviceName))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddEntityFrameworkCoreInstrumentation()
        .AddSource("BookingPlatform.Saga")
        .AddOtlpExporter());

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
        policy.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());
});

builder.Logging.AddConsole();
builder.Logging.AddJsonConsole();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BookingDbContext>();
    await db.Database.EnsureDeletedAsync();
    await db.Database.EnsureCreatedAsync();
}

var consumer = app.Services.GetRequiredService<BookingEventConsumer>();
await consumer.StartAsync();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<ExceptionMiddleware>();
app.UseCors();
app.UseRouting();
app.MapControllers();
app.MapHealthChecks("/health");
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = _ => true
});

await app.RunAsync();
