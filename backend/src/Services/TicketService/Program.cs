using BookingPlatform.Common;
using BookingPlatform.Common.Interfaces;
using BookingPlatform.Common.Middleware;
using BookingPlatform.Common.Outbox;
using Microsoft.EntityFrameworkCore;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using TicketService.Infrastructure.Messaging;
using TicketService.Infrastructure.Outbox;
using TicketService.Infrastructure.Persistence;
using System.Reflection;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddBookingPlatformCommon();
builder.Services.AddRabbitMQ("ticket");
builder.Services.AddOutbox();
builder.Services.AddMediatR(cfg => cfg.RegisterServicesFromAssembly(Assembly.GetExecutingAssembly()));

builder.Services.AddDbContext<TicketDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("TicketDB"),
        npgsqlOptions => npgsqlOptions.EnableRetryOnFailure(3)));

builder.Services.AddScoped<IOutboxService, TicketOutboxService>();
builder.Services.AddSingleton<TicketEventConsumer>();

builder.Services.AddHealthChecks();

var serviceName = "TicketService";
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService(serviceName))
    .WithTracing(tracing => tracing
        .AddAspNetCoreInstrumentation()
        .AddEntityFrameworkCoreInstrumentation()
        .AddOtlpExporter());

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<TicketDbContext>();
    await db.Database.EnsureDeletedAsync();
    await db.Database.EnsureCreatedAsync();
}

var consumer = app.Services.GetRequiredService<TicketEventConsumer>();
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
