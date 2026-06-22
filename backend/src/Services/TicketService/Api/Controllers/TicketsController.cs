using MediatR;
using Microsoft.AspNetCore.Mvc;
using TicketService.Application.Commands;

namespace TicketService.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class TicketsController : ControllerBase
{
    private readonly IMediator _mediator;

    public TicketsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("issue")]
    public async Task<IActionResult> Issue([FromBody] IssueTicketRequest request)
    {
        var command = new IssueTicketCommand(request.BookingId);
        var result = await _mediator.Send(command);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("cancel")]
    public async Task<IActionResult> Cancel([FromBody] CancelTicketRequest request)
    {
        var command = new CancelTicketCommand(request.BookingId);
        var result = await _mediator.Send(command);
        return Ok(result);
    }
}

public class IssueTicketRequest
{
    public Guid BookingId { get; set; }
}

public class CancelTicketRequest
{
    public Guid BookingId { get; set; }
}
