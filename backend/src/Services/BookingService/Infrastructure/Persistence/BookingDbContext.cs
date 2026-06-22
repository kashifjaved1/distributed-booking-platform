using BookingPlatform.Common.Interfaces;
using BookingPlatform.Common.Outbox;
using BookingService.Domain.Aggregates;
using Microsoft.EntityFrameworkCore;

namespace BookingService.Infrastructure.Persistence;

public class BookingDbContext : DbContext
{
    public DbSet<Booking> Bookings => Set<Booking>();
    public DbSet<SagaState> SagaStates => Set<SagaState>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public BookingDbContext(DbContextOptions<BookingDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("booking");

        modelBuilder.Entity<Booking>(entity =>
        {
            entity.ToTable("Bookings");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.CustomerEmail).IsRequired().HasMaxLength(256);
            entity.Property(e => e.CustomerName).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Amount).HasPrecision(18, 2);
            entity.Property(e => e.Status).IsRequired().HasConversion<string>().HasMaxLength(50);
            entity.Property(e => e.RowVersion).HasColumnType("bytea").IsConcurrencyToken();
            entity.HasIndex(e => e.CustomerEmail);
            entity.HasIndex(e => e.Status);
            entity.HasIndex(e => e.CreatedAt);
            entity.Ignore(e => e.DomainEvents);
        });

        modelBuilder.Entity<SagaState>(entity =>
        {
            entity.ToTable("BookingSagas");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.CurrentStep).IsRequired().HasConversion<string>().HasMaxLength(50);
            entity.Property(e => e.Status).IsRequired().HasConversion<string>().HasMaxLength(50);
            entity.Property(e => e.LastError).HasMaxLength(2000);
            entity.Property(e => e.RowVersion).HasColumnType("bytea").IsConcurrencyToken();
            entity.HasIndex(e => e.BookingId).IsUnique();
            entity.HasIndex(e => e.Status);
        });

        modelBuilder.ConfigureOutbox("booking");
    }
}
