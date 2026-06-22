using BookingPlatform.Common.Interfaces;
using BookingPlatform.Common.Outbox;
using Microsoft.EntityFrameworkCore;
using SeatService.Domain.Aggregates;

namespace SeatService.Infrastructure.Persistence;

public class SeatDbContext : DbContext
{
    public DbSet<Seat> Seats => Set<Seat>();
    public DbSet<SeatReservation> Reservations => Set<SeatReservation>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public SeatDbContext(DbContextOptions<SeatDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("seat");

        modelBuilder.Entity<Seat>(entity =>
        {
            entity.ToTable("Seats");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.SeatNumber).IsRequired().HasMaxLength(20);
            entity.Property(e => e.Section).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Price).HasPrecision(18, 2);
            entity.Property(e => e.Status).IsRequired().HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.RowVersion).HasColumnType("bytea").IsConcurrencyToken();
            entity.HasIndex(e => e.SeatNumber).IsUnique();
            entity.HasIndex(e => e.Status);
        });

        modelBuilder.Entity<SeatReservation>(entity =>
        {
            entity.ToTable("SeatReservations");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.Status).IsRequired().HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.RowVersion).HasColumnType("bytea").IsConcurrencyToken();
            entity.HasIndex(e => e.BookingId).IsUnique();
            entity.HasIndex(e => new { e.SeatId, e.Status });
        });

        modelBuilder.ConfigureOutbox("seat");
    }
}
