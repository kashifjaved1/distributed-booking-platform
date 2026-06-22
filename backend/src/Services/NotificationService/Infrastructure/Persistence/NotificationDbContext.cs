using BookingPlatform.Common.Interfaces;
using BookingPlatform.Common.Outbox;
using Microsoft.EntityFrameworkCore;
using NotificationService.Domain.Aggregates;

namespace NotificationService.Infrastructure.Persistence;

public class NotificationDbContext : DbContext
{
    public DbSet<EmailLog> EmailLogs => Set<EmailLog>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public NotificationDbContext(DbContextOptions<NotificationDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("notification");

        modelBuilder.Entity<EmailLog>(entity =>
        {
            entity.ToTable("EmailLogs");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.RecipientEmail).IsRequired().HasMaxLength(256);
            entity.Property(e => e.Subject).IsRequired().HasMaxLength(500);
            entity.Property(e => e.Body).IsRequired();
            entity.Property(e => e.Status).IsRequired().HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.Error).HasMaxLength(2000);
            entity.Property(e => e.RowVersion).HasColumnType("bytea").IsConcurrencyToken();
            entity.HasIndex(e => e.BookingId);
            entity.HasIndex(e => e.Status);
        });

        modelBuilder.ConfigureOutbox("notification");
    }
}
