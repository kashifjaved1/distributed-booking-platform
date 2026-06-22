import React, { useState } from 'react';
import { 
  Folder, FolderOpen, FileCode, Copy, Check, ChevronRight, Terminal 
} from 'lucide-react';

interface CodeFile {
  name: string;
  path: string;
  language: string;
  content: string;
}

interface CodeFolder {
  name: string;
  files?: CodeFile[];
  folders?: CodeFolder[];
}

export default function CodeExplorer() {
  const [selectedFile, setSelectedFile] = useState<string>('BookingSagaOrchestrator.cs');
  const [copied, setCopied] = useState(false);
  const [openFolders, setOpenFolders] = useState<Record<string, boolean>>({
    'Services': true,
    'BookingService': true,
    'SeatService': false,
    'PaymentService': false,
    'BuildingBlocks': true,
    'Outbox': true,
    'Messaging': true
  });

  const toggleFolder = (folderName: string) => {
    setOpenFolders(prev => ({
      ...prev,
      [folderName]: !prev[folderName]
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const fileRepository: Record<string, CodeFile> = {
    'Booking.cs': {
      name: 'Booking.cs',
      path: 'Services/BookingService/Domain/Booking.cs',
      language: 'csharp',
      content: `//-----------------------------------------------------------------------------------------------------------------
// <license>SPDX-License-Identifier: Apache-2.0</license>
// <scenario>Booking Service Aggregate Root maintaining transactional status boundaries according to Domain Driven Design</scenario>
//-----------------------------------------------------------------------------------------------------------------
namespace DistributedBooking.BookingService.Domain;

using System;
using System.Collections.Generic;

public sealed class Booking : AggregateRoot<Guid>
{
    public Guid CustomerId { get; private set; }
    public string SeatNumber { get; private set; } = null!;
    public decimal Amount { get; private set; }
    public BookingStatus Status { get; private set; }
    public DateTime CreatedAt { get; private set; }
    public byte[] RowVersion { get; private set; } = null!; // EF Core Concurrency Token

    // Primary constructor for ORMs
    private Booking() { }

    public static Booking Create(Guid customerId, string seatNumber, decimal amount)
    {
        if (amount <= 0)
            throw new ArgumentException("Booking valuation amount must map positive scale.", nameof(amount));
            
        if (string.IsNullOrWhiteSpace(seatNumber))
            throw new ArgumentException("Seat pre-allocation must target a physical seat index.", nameof(seatNumber));

        var booking = new Booking
        {
            Id = Guid.NewGuid(),
            CustomerId = customerId,
            SeatNumber = seatNumber,
            Amount = amount,
            Status = BookingStatus.Pending,
            CreatedAt = DateTime.UtcNow
        };

        // Raise domain event to initiate atomic transaction sequences
        booking.AddDomainEvent(new BookingCreatedEvent(booking.Id, booking.CustomerId, booking.SeatNumber, booking.Amount));

        return booking;
    }

    public void Confirm()
    {
        if (Status != BookingStatus.Pending)
            throw new InvalidOperationException($"Invalid state redirection. Current state: {Status}");

        Status = BookingStatus.Confirmed;
        AddDomainEvent(new BookingConfirmedEvent(Id));
    }

    public void Reject()
    {
        if (Status == BookingStatus.Confirmed)
            throw new InvalidOperationException("Confirmed booking aggregates cannot transition to rejected status.");

        Status = BookingStatus.Rejected;
        AddDomainEvent(new BookingFailedEvent(Id, "Saga compensation execution finalized rejection state."));
    }
}

public enum BookingStatus
{
    Pending,
    Confirmed,
    Rejected
}`
    },
    'BookingSagaOrchestrator.cs': {
      name: 'BookingSagaOrchestrator.cs',
      path: 'Services/BookingService/Saga/BookingSagaOrchestrator.cs',
      language: 'csharp',
      content: `//-----------------------------------------------------------------------------------------------------------------
// <license>SPDX-License-Identifier: Apache-2.0</license>
// <pattern>Orchestrated Saga Pipeline controlling microservices boundaries state machines</pattern>
//-----------------------------------------------------------------------------------------------------------------
namespace DistributedBooking.BookingService.Saga;

using System;
using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using DistributedBooking.BuildingBlocks.Messaging;
using DistributedBooking.BookingService.Domain;

public sealed class BookingSagaOrchestrator : ISagaOrchestrator<BookingSagaState>
{
    private readonly ISagaStateRepository _sagaRepository;
    private readonly IOutboxPublisher _outbox;
    private readonly ILogger<BookingSagaOrchestrator> _logger;

    public BookingSagaOrchestrator(
        ISagaStateRepository sagaRepository,
        IOutboxPublisher outbox,
        ILogger<BookingSagaOrchestrator> logger)
    {
        _sagaRepository = sagaRepository;
        _outbox = outbox;
        _logger = logger;
    }

    public async Task HandleAsync(SeatReservedEvent message, SagaContext context)
    {
        _logger.LogInformation("[SAGA] Consumed SeatReservedEvent. CorrelationId: {CorrelationId}", context.CorrelationId);
        
        var saga = await _sagaRepository.GetByBookingIdAsync(message.BookingId);
        if (saga == null) return;

        // Checkpoint transition
        saga.SeatReserved = true;
        saga.CurrentState = SagaStateNames.PaymentAuthorizing;
        saga.LastUpdated = DateTime.UtcNow;

        // Atomic write to outbox triggering Payment charging command
        var command = new AuthorizePaymentCommand(saga.BookingId, saga.CustomerId, saga.Amount);
        
        await _sagaRepository.SaveDbChangesWithOutboxAsync(saga, command, context.CorrelationId);
    }

    public async Task HandleAsync(PaymentAuthorizedEvent message, SagaContext context)
    {
        _logger.LogInformation("[SAGA] Consumed PaymentAuthorizedEvent. Charging approved. CorrelationId: {CorrelationId}", context.CorrelationId);
        
        var saga = await _sagaRepository.GetByBookingIdAsync(message.BookingId);
        if (saga == null) return;

        saga.PaymentAuthorized = true;
        saga.CurrentState = SagaStateNames.TicketIssuing;
        saga.LastUpdated = DateTime.UtcNow;

        // Publish IssueTicketCommand
        var command = new IssueTicketCommand(saga.BookingId, saga.SeatNumber);
        
        await _sagaRepository.SaveDbChangesWithOutboxAsync(saga, command, context.CorrelationId);
    }

    public async Task HandleAsync(TicketIssuedEvent message, SagaContext context)
    {
        _logger.LogInformation("[SAGA] Consumed TicketIssuedEvent. CorrelationId: {CorrelationId}", context.CorrelationId);
        
        var saga = await _sagaRepository.GetByBookingIdAsync(message.BookingId);
        if (saga == null) return;

        saga.TicketIssued = true;
        saga.CurrentState = SagaStateNames.Completed;
        saga.LastUpdated = DateTime.UtcNow;

        // Atomic Confirm local bookings aggregate
        var booking = await _sagaRepository.GetBookingByIdAsync(saga.BookingId);
        booking.Confirm();

        // Queue async Notification email command (Fire and Forget - failure does not rollback ACID pipeline)
        var emailCommand = new SendNotificationCommand(saga.BookingId, saga.SeatNumber);

        await _sagaRepository.SaveSagaAndBookingWithOutboxAsync(saga, booking, emailCommand, context.CorrelationId);
        
        _logger.LogInformation("[SAGA COMPLETE] Distributed Booking transaction confirmed successfully. BookingId: {BookingId}", saga.BookingId);
    }

    public async Task HandleAsync(PaymentAuthorizationFailedEvent message, SagaContext context)
    {
        _logger.LogWarning("[SAGA COMPENSATING] Payment Authorized DECLINED. Core failure scenario. Initiating rollback compensation logic.");
        
        var saga = await _sagaRepository.GetByBookingIdAsync(message.BookingId);
        if (saga == null) return;

        saga.CurrentState = SagaStateNames.CompensatingSeat;
        saga.LastUpdated = DateTime.UtcNow;

        // Stage 1 rollback: Release seat reservation
        var releaseCommand = new ReleaseSeatCommand(saga.BookingId, saga.SeatNumber);

        await _sagaRepository.SaveDbChangesWithOutboxAsync(saga, releaseCommand, context.CorrelationId);
    }

    public async Task HandleAsync(TicketIssueFailedEvent message, SagaContext context)
    {
        _logger.LogError("[SAGA COMPENSATING] Ticket registration fault encountered. Triggering reverse charge rollback path.");

        var saga = await _sagaRepository.GetByBookingIdAsync(message.BookingId);
        if (saga == null) return;

        saga.CurrentState = SagaStateNames.CompensatingPayment;
        saga.LastUpdated = DateTime.UtcNow;

        // Multi-service complex rollback chain. Step 1: Refund charged cash
        var refundCommand = new RefundPaymentCommand(saga.BookingId, saga.Amount);

        await _sagaRepository.SaveDbChangesWithOutboxAsync(saga, refundCommand, context.CorrelationId);
    }
}`
    },
    'BookingSagaState.cs': {
      name: 'BookingSagaState.cs',
      path: 'Services/BookingService/Saga/BookingSagaState.cs',
      language: 'csharp',
      content: `namespace DistributedBooking.BookingService.Saga;

using System;

public sealed class BookingSagaState
{
    public Guid SagaId { get; set; }
    public Guid BookingId { get; set; }
    public Guid CustomerId { get; set; }
    public string SeatNumber { get; set; } = null!;
    public decimal Amount { get; set; }
    public string CurrentState { get; set; } = SagaStateNames.Start;
    
    // Checkpoint flags to ensure idempotent tracking of compensation actions
    public bool SeatReserved { get; set; }
    public bool PaymentAuthorized { get; set; }
    public bool TicketIssued { get; set; }
    public bool EmailSent { get; set; }
    public int RetryCount { get; set; }
    
    public string CorrelationId { get; set; } = null!;
    public DateTime LastUpdated { get; set; }
}

public static class SagaStateNames
{
    public const string Start = "START";
    public const string SeatReserving = "SEAT_RESERVING";
    public const string PaymentAuthorizing = "PAYMENT_AUTHORIZING";
    public const string TicketIssuing = "TICKET_ISSUING";
    public const string CompensatingPayment = "COMPENSATING_PAYMENT";
    public const string CompensatingSeat = "COMPENSATING_SEAT";
    public const string Completed = "COMPLETED";
    public const string Failed = "FAILED";
}`
    },
    'ReserveSeatConsumer.cs': {
      name: 'ReserveSeatConsumer.cs',
      path: 'Services/SeatService/Consumers/ReserveSeatConsumer.cs',
      language: 'csharp',
      content: `namespace DistributedBooking.SeatService.Consumers;

using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using DistributedBooking.BuildingBlocks.Messaging;
using DistributedBooking.SeatService.Domain;

// Consumer validating seat inventory with Transactional Outbox matching state
public sealed class ReserveSeatConsumer : IConsumer<ReserveSeatCommand>
{
    private readonly ISeatRepository _repository;
    private readonly ILogger<ReserveSeatConsumer> _logger;

    public ReserveSeatConsumer(ISeatRepository repository, ILogger<ReserveSeatConsumer> logger)
    {
        _repository = repository;
        _logger = logger;
    }

    public async Task ConsumeAsync(ReserveSeatCommand message, ConsumeContext context)
    {
        _logger.LogInformation("[SEAT SERVICE] Consumed ReserveSeatCommand for target seat {SeatNumber}. CorrelationId: {CorrelationId}", 
            message.SeatNumber, context.CorrelationId);

        // Fetch seat allocation inside PostgreSQL lock boundaries (SELECT FOR UPDATE)
        var seat = await _repository.GetAndLockAsync(message.SeatNumber);
        
        if (seat == null || seat.Status != SeatStatus.Available)
        {
            _logger.LogWarning("[SEAT SERVICE] Reservation failed! Seat {SeatNumber} is non-available.", message.SeatNumber);
            
            // Atomic failure event logged to output Outbox messages. Outbox & seat state committed in same DB transaction.
            var failEvent = new SeatReservationFailedEvent(message.BookingId, message.SeatNumber, "SEAT_UNAVAILABLE");
            await _repository.SaveWithOutboxAsync(seat, failEvent, context.CorrelationId);
            return;
        }

        // Apply state transition
        seat.Reserve(message.BookingId);

        // Success Event definition
        var successEvent = new SeatReservedEvent(message.BookingId, message.SeatNumber);

        // Write atomic modifications inside SeatDB constraints
        await _repository.SaveWithOutboxAsync(seat, successEvent, context.CorrelationId);
        
        _logger.LogInformation("[SEAT SERVICE] Seat reserved atomically. Outbox event registered.");
    }
}`
    },
    'AuthorizePaymentConsumer.cs': {
      name: 'AuthorizePaymentConsumer.cs',
      path: 'Services/PaymentService/Consumers/AuthorizePaymentConsumer.cs',
      language: 'csharp',
      content: `namespace DistributedBooking.PaymentService.Consumers;

using System.Threading.Tasks;
using Microsoft.Extensions.Logging;
using DistributedBooking.BuildingBlocks.Messaging;
using DistributedBooking.PaymentService.Domain;

public sealed class AuthorizePaymentConsumer : IConsumer<AuthorizePaymentCommand>
{
    private readonly IPaymentProcessor _processor; // Mock external gateway
    private readonly IPaymentRepository _repository;
    private readonly ILogger<AuthorizePaymentConsumer> _logger;

    public AuthorizePaymentConsumer(
        IPaymentProcessor processor, 
        IPaymentRepository repository, 
        ILogger<AuthorizePaymentConsumer> logger)
    {
        _processor = processor;
        _repository = repository;
        _logger = logger;
    }

    public async Task ConsumeAsync(AuthorizePaymentCommand message, ConsumeContext context)
    {
        _logger.LogInformation("[PAYMENT SERVICE] Authorizing charge of {Amount}. CorrelationId: {CorrelationId}", 
            message.Amount, context.CorrelationId);

        // Call external Stripe merchant processing mock API
        var gatewayResult = await _processor.AuthorizeAsync(message.CustomerId, message.Amount);

        if (!gatewayResult.IsApproved)
        {
            _logger.LogWarning("[PAYMENT SERVICE] Merchant card charge DECLINED: {Reason}", gatewayResult.FailureReason);
            
            var failEvent = new PaymentAuthorizationFailedEvent(message.BookingId, gatewayResult.FailureReason);
            await _repository.SaveWithOutboxAsync(message.BookingId, PaymentStatus.Declined, failEvent, context.CorrelationId);
            return;
        }

        // Save billing authorization and write outbound reply atomically to DB Outbox table
        var transaction = PaymentTransaction.Create(message.BookingId, message.Amount, gatewayResult.AuthToken);
        var successEvent = new PaymentAuthorizedEvent(message.BookingId, transaction.GatewayReference);

        await _repository.SaveTransactionWithOutboxAsync(transaction, successEvent, context.CorrelationId);

        _logger.LogInformation("[PAYMENT SERVICE] Balance authorized. DB Transaction completed.");
    }
}`
    },
    'OutboxMessage.cs': {
      name: 'OutboxMessage.cs',
      path: 'BuildingBlocks/Outbox/OutboxMessage.cs',
      language: 'csharp',
      content: `namespace DistributedBooking.BuildingBlocks.Outbox;

using System;

public sealed class OutboxMessage
{
    public Guid Id { get; set; }
    public string AggregateType { get; set; } = null!;
    public string AggregateId { get; set; } = null!;
    public string EventType { get; set; } = null!;
    public string Payload { get; set; } = null!; // Serialization parameters
    public MessageStatus Status { get; set; } = MessageStatus.Pending;
    public string CorrelationId { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ProcessedAt { get; set; }
}

public enum MessageStatus
{
    Pending,
    Published,
    Failed
}`
    },
    'OutboxPublisher.cs': {
      name: 'OutboxPublisher.cs',
      path: 'BuildingBlocks/Outbox/OutboxPublisher.cs',
      language: 'csharp',
      content: `namespace DistributedBooking.BuildingBlocks.Outbox;

using System;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.EntityFrameworkCore;
using DistributedBooking.BuildingBlocks.Messaging;

// Highly performant background polling task (Transactional Outbox Publisher pipeline)
public sealed class OutboxPublisher : BackgroundService
{
    private readonly IDbContextFactory<BookingDbContext> _contextFactory;
    private readonly IMessageBroker _broker;
    private readonly ILogger<OutboxPublisher> _logger;

    public OutboxPublisher(
        IDbContextFactory<BookingDbContext> contextFactory,
        IMessageBroker broker,
        ILogger<OutboxPublisher> logger)
    {
        _contextFactory = contextFactory;
        _broker = broker;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        _logger.LogInformation("Atomic Outbox publisher thread started. Polling interval: 250ms.");

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PublishPendingOutboxMessagesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Exception encountered in outbox publisher loop.");
            }

            await Task.Delay(250, stoppingToken);
        }
    }

    private async Task PublishPendingOutboxMessagesAsync()
    {
        using var context = await _contextFactory.CreateDbContextAsync();

        // 1. Fetch unpolished sequences using index. Fetch with pessimistic lock to prevent double publishers
        var pendingMessages = await context.OutboxMessages
            .Where(m => m.Status == MessageStatus.Pending)
            .OrderBy(m => m.CreatedAt)
            .Take(20)
            .ToListAsync();

        if (pendingMessages.Count == 0) return;

        foreach (var message in pendingMessages)
        {
            try
            {
                // 2. Publish to RabbitMQ AMQP exchange with correlation tracing headers attached (W3C propagation)
                await _broker.PublishAsync(
                    exchange: GetExchangeForAggregate(message.AggregateType),
                    routingKey: message.EventType,
                    payload: message.Payload,
                    correlationId: message.CorrelationId);

                // 3. Complete and mark as processed in localized DB context
                message.Status = MessageStatus.Published;
                message.ProcessedAt = DateTime.UtcNow;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to publish outbox message id={Id}. Marking as processing failed.", message.Id);
                message.Status = MessageStatus.Failed;
            }
        }

        // Commit modifications to DB
        await context.SaveChangesAsync();
    }

    private string GetExchangeForAggregate(string aggregateType) =>
        aggregateType.ToLower() switch
        {
            "booking" => "booking.exchange",
            "seat" => "seat.exchange",
            "payment" => "payment.exchange",
            "ticket" => "ticket.exchange",
            "notification" => "notification.exchange",
            _ => "system.exchange"
        };
}`
    },
    'IdempotentConsumer.cs': {
      name: 'IdempotentConsumer.cs',
      path: 'BuildingBlocks/Messaging/IdempotentConsumer.cs',
      language: 'csharp',
      content: `namespace DistributedBooking.BuildingBlocks.Messaging;

using System;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;

// Abstract wrapper integrating microservice inbox check to filter duplicate RabbitMQ deliveries
public abstract class IdempotentConsumer<TMessage, TDbContext> : IConsumer<TMessage>
    where TMessage : class
    where TDbContext : DbContext
{
    private readonly TDbContext _db;

    protected IdempotentConsumer(TDbContext db)
    {
        _db = db;
    }

    public async Task ConsumeAsync(TMessage message, ConsumeContext context)
    {
        // Compute message fingerprint (usually using Combination of CorrelationID + EventType)
        string inboxFingerprint = \`inbox-\${context.MessageId}-\${typeof(TMessage).Name}\`;

        using var dbTransaction = await _db.Database.BeginTransactionAsync();

        try
        {
            // Try to insert Inbox fingerprint. If constraint fails, it is duplicate!
            bool alreadyProcessed = await CheckInboxAlreadyProcessedAsync(inboxFingerprint);

            if (alreadyProcessed)
            {
                // Duplicate publication discarded gracefully without processing domain core changes
                await dbTransaction.RollbackAsync();
                return;
            }

            // Execute actual domain aggregate updates
            await ProcessDomainMessageAsync(message, context);

            // Register Inbox key
            await RegisterInboxMessageKeyAsync(inboxFingerprint);

            await _db.SaveChangesAsync();
            await dbTransaction.CommitAsync();
        }
        catch (DbUpdateException)
        {
            // Unique index boundary hit, duplicate command discarded safely.
            await dbTransaction.RollbackAsync();
        }
    }

    protected abstract Task ProcessDomainMessageAsync(TMessage message, ConsumeContext context);

    private async Task<bool> CheckInboxAlreadyProcessedAsync(string key) =>
        await _db.Set<ProcessedInboxMessage>().AnyAsync(p => p.Key == key);

    private async Task RegisterInboxMessageKeyAsync(string key) =>
        await _db.Set<ProcessedInboxMessage>().AddAsync(new ProcessedInboxMessage { Key = key, ProcessedAt = DateTime.UtcNow });
}

public sealed class ProcessedInboxMessage
{
    public string Key { get; set; } = null!;
    public DateTime ProcessedAt { get; set; }
}`
    }
  };

  const fileTree: CodeFolder[] = [
    {
      name: 'Services',
      folders: [
        {
          name: 'BookingService',
          folders: [
            {
              name: 'Domain',
              files: [fileRepository['Booking.cs']]
            },
            {
              name: 'Saga',
              files: [
                fileRepository['BookingSagaOrchestrator.cs'],
                fileRepository['BookingSagaState.cs']
              ]
            }
          ]
        },
        {
          name: 'SeatService',
          folders: [
            {
              name: 'Consumers',
              files: [fileRepository['ReserveSeatConsumer.cs']]
            }
          ]
        },
        {
          name: 'PaymentService',
          folders: [
            {
              name: 'Consumers',
              files: [fileRepository['AuthorizePaymentConsumer.cs']]
            }
          ]
        }
      ]
    },
    {
      name: 'BuildingBlocks',
      folders: [
        {
          name: 'Outbox',
          files: [
            fileRepository['OutboxMessage.cs'],
            fileRepository['OutboxPublisher.cs']
          ]
        },
        {
          name: 'Messaging',
          files: [fileRepository['IdempotentConsumer.cs']]
        }
      ]
    }
  ];

  const currentFile = fileRepository[selectedFile] || fileRepository['BookingSagaOrchestrator.cs'];

  const renderFileTree = (nodes: CodeFolder[]) => {
    return nodes.map((node) => {
      const isOpen = openFolders[node.name] || false;
      return (
        <div key={node.name} className="space-y-1">
          <button 
            onClick={() => toggleFolder(node.name)}
            className="w-full flex items-center gap-1.5 py-1 px-1.5 text-slate-350 hover:text-white rounded hover:bg-slate-800 transition-colors text-xs font-semibold"
          >
            <ChevronRight className={`h-3 w-3 shrink-0 transition-transform ${isOpen ? 'transform rotate-90' : ''}`} />
            {isOpen ? <FolderOpen className="h-3.5 w-3.5 text-amber-400 fill-amber-400/10" /> : <Folder className="h-3.5 w-3.5 text-amber-500 fill-amber-500/10" />}
            <span className="truncate">{node.name}</span>
          </button>
          
          {isOpen && (
            <div className="pl-3.5 border-l border-slate-800 space-y-1.5 ml-2.5">
              {node.folders && renderFileTree(node.folders)}
              {node.files && node.files.map((file) => (
                <button
                  key={file.name}
                  onClick={() => setSelectedFile(file.name)}
                  className={`w-full flex items-center gap-2 py-1 px-1.5 rounded text-left text-xs font-mono transition-colors ${
                    selectedFile === file.name 
                      ? 'bg-indigo-600/20 text-indigo-300 border-l border-indigo-500 font-bold' 
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/55'
                  }`}
                >
                  <FileCode className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">{file.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl shadow-lg overflow-hidden flex flex-col md:flex-row h-[550px]" id="repository-browser">
      {/* File Tree Column */}
      <div className="w-full md:w-64 bg-slate-950 p-4 border-b md:border-b-0 md:border-r border-slate-850 flex flex-col h-1/2 md:h-full justify-between" id="code-tree-column">
        <div className="space-y-4 overflow-y-auto">
          <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 px-1">
            <Terminal className="h-4 w-4 text-sky-400 animate-pulse" />
            Repository Root
          </h3>
          <div className="space-y-1.5" id="file-tree-viewer">
            {renderFileTree(fileTree)}
          </div>
        </div>
        <div className="pt-3 border-t border-slate-850 text-[10px] text-slate-500 px-1 font-mono">
          TargetFramework: <span className="text-emerald-400">net9.0</span>
        </div>
      </div>

      {/* Code Text Editor Frame */}
      <div className="flex-1 flex flex-col h-1/2 md:h-full bg-slate-900 text-slate-300 relative" id="code-editor-column">
        <div className="border-b border-slate-850 px-6 py-3 bg-slate-950 flex items-center justify-between">
          <div className="font-mono text-xs text-slate-400 truncate">
            {currentFile.path}
          </div>
          <button
            onClick={() => copyToClipboard(currentFile.content)}
            className="p-1 px-2 border border-slate-800 hover:border-slate-700 bg-slate-950 hover:bg-slate-900 rounded text-[11px] font-bold font-mono text-slate-400 hover:text-white flex items-center gap-1.5 transition-all focus:outline-none"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-emerald-500" />
                <span className="text-emerald-400 font-semibold">COPIED</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>COPY</span>
              </>
            )}
          </button>
        </div>

        {/* Output Area */}
        <pre className="flex-1 p-6 overflow-auto text-xs font-mono leading-relaxed bg-slate-950 text-slate-300 block select-text focus:outline-none scrollbar-thin overflow-x-auto" id="editor-screen-wrapper">
          <code className="block whitespace-pre select-text" style={{ fontFeatureSettings: '"calt" 1, "liga" 1' }}>
            {/* Simple syntax highlighting mock for beautiful IDE aesthetics */}
            {currentFile.content.split('\n').map((line, idx) => {
              // Highlight comments
              if (line.trim().startsWith('//')) {
                return (
                  <span key={idx} className="text-slate-550 italic block">
                    {line}
                  </span>
                );
              }
              
              // Key coloring namespaces
              let highlightedLine = line
                .replace(/\b(class|struct|sealed|public|private|protected|readonly|internal|namespace|using|void|async|await|return|string|int|Guid|decimal|byte|bool|DateTime|new|static|enum)\b/g, '<span class="text-cyan-400 font-medium">$1</span>')
                .replace(/\b(throw|if|await|is|null|switch)\b/g, '<span class="text-pink-400">$1</span>')
                .replace(/"([^"]*)"/g, '<span class="text-emerald-400">"$1"</span>')
                .replace(/\b(AddDomainEvent|Confirm|Reject|Create|PublishAsync|SaveDbChangesWithOutboxAsync|HandleAsync|ConsumeAsync|SaveWithOutboxAsync)\b/g, '<span class="text-yellow-300 font-medium">$1</span>');

              return (
                <span 
                  key={idx} 
                  className="block min-h-[1.25rem]"
                  dangerouslySetInnerHTML={{ __html: highlightedLine }}
                />
              );
            })}
          </code>
        </pre>
      </div>
    </div>
  );
}
