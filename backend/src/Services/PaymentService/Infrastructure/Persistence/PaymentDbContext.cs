using BookingPlatform.Common.Interfaces;
using BookingPlatform.Common.Outbox;
using Microsoft.EntityFrameworkCore;
using PaymentService.Domain.Aggregates;

namespace PaymentService.Infrastructure.Persistence;

public class PaymentDbContext : DbContext
{
    public DbSet<Payment> Payments => Set<Payment>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public PaymentDbContext(DbContextOptions<PaymentDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("payment");

        modelBuilder.Entity<Payment>(entity =>
        {
            entity.ToTable("Payments");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Amount).HasPrecision(18, 2);
            entity.Property(e => e.Currency).IsRequired().HasMaxLength(3);
            entity.Property(e => e.Status).IsRequired().HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.TransactionId).HasMaxLength(200);
            entity.Property(e => e.FailureReason).HasMaxLength(2000);
            entity.Property(e => e.RowVersion).HasColumnType("bytea").IsConcurrencyToken();
            entity.HasIndex(e => e.BookingId).IsUnique();
            entity.HasIndex(e => e.Status);
        });

        modelBuilder.ConfigureOutbox("payment");
    }
}
