using MediatR;
using Microsoft.AspNetCore.Mvc;
using SeatService.Application.Commands;

namespace SeatService.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SeatsController : ControllerBase
{
    private readonly IMediator _mediator;
    private readonly ILogger<SeatsController> _logger;

    public SeatsController(IMediator mediator, ILogger<SeatsController> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    [HttpPost("reserve")]
    public async Task<IActionResult> Reserve([FromBody] ReserveSeatRequest request)
    {
        var command = new ReserveSeatCommand(request.SeatId, request.BookingId);
        var result = await _mediator.Send(command);

        if (!result.Success)
            return Conflict(new { result.Success, result.ReservationId, Message = "Seat could not be reserved" });

        return Ok(result);
    }

    [HttpPost("release")]
    public async Task<IActionResult> Release([FromBody] ReleaseSeatRequest request)
    {
        var command = new ReleaseSeatCommand(request.SeatId, request.BookingId);
        var result = await _mediator.Send(command);

        return Ok(result);
    }
}

public class ReserveSeatRequest
{
    public Guid SeatId { get; set; }
    public Guid BookingId { get; set; }
}

public class ReleaseSeatRequest
{
    public Guid SeatId { get; set; }
    public Guid BookingId { get; set; }
}
