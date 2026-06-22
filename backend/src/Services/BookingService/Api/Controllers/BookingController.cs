using BookingService.Api.Models;
using BookingService.Application.Commands;
using MediatR;
using Microsoft.AspNetCore.Mvc;

namespace BookingService.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class BookingsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<BookingsController> _logger;

    public BookingsController(IMediator mediator, ILogger<BookingsController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    [HttpPost]
    public async Task<IActionResult> CreateBooking([FromBody] CreateBookingRequest request)
    {
        var command = new CreateBookingCommand(
            request.SeatId,
            request.CustomerEmail,
            request.CustomerName,
            request.Amount,
            request.Currency ?? "USD",
            request.IdempotencyKey);

        var result = await _mediator.Send(command);

        _logger.LogInformation("Booking {BookingId} created with status {Status}", result.BookingId, result.Status);

        return Accepted(new
        {
            result.BookingId,
            result.Status,
            Links = new
            {
                Self = Url.Link(nameof(GetBooking), new { id = result.BookingId })
            }
        });
    }

    [HttpGet("{id:guid}", Name = nameof(GetBooking))]
    public async Task<IActionResult> GetBooking(Guid id)
    {
        return Ok();
    }
}
