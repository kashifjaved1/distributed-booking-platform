using BookingPlatform.Common.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace BookingPlatform.Common.Outbox;

public static class OutboxDbContextExtensions
{
    public static void ConfigureOutbox(this ModelBuilder modelBuilder, string schema = "public")
    {
        modelBuilder.Entity<OutboxMessage>(entity =>
        {
            entity.ToTable("OutboxMessages", schema);
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.EventType).IsRequired().HasMaxLength(500);
            entity.Property(e => e.Payload).IsRequired();
            entity.Property(e => e.CorrelationId).IsRequired().HasMaxLength(64);
            entity.Property(e => e.CausationId).HasMaxLength(64);
            entity.Property(e => e.OccurredOn).IsRequired();
            entity.Property(e => e.Status).IsRequired();
            entity.Property(e => e.Error).HasMaxLength(2000);
            entity.Property(e => e.RowVersion).HasColumnType("bytea").IsConcurrencyToken();
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.OccurredOn);
            entity.HasIndex(e => new { e.Status, e.RetryCount, e.OccurredOn });
        });
    }
}
