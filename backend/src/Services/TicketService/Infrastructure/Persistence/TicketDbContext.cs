using BookingPlatform.Common.Interfaces;
using BookingPlatform.Common.Outbox;
using Microsoft.EntityFrameworkCore;
using TicketService.Domain.Aggregates;

namespace TicketService.Infrastructure.Persistence;

public class TicketDbContext : DbContext
{
    public DbSet<Ticket> Tickets => Set<Ticket>();
    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public TicketDbContext(DbContextOptions<TicketDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.HasDefaultSchema("ticket");

        modelBuilder.Entity<Ticket>(entity =>
        {
            entity.ToTable("Tickets");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Id).ValueGeneratedNever();
            entity.Property(e => e.TicketNumber).IsRequired().HasMaxLength(50);
            entity.Property(e => e.Status).IsRequired().HasConversion<string>().HasMaxLength(20);
            entity.Property(e => e.RowVersion).HasColumnType("bytea").IsConcurrencyToken();
            entity.HasIndex(e => e.BookingId).IsUnique();
            entity.HasIndex(e => e.TicketNumber).IsUnique();
            entity.HasIndex(e => e.Status);
        });

        modelBuilder.ConfigureOutbox("ticket");
    }
}
