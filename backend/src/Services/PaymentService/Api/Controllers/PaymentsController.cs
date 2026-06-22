using MediatR;
using Microsoft.AspNetCore.Mvc;
using PaymentService.Application.Commands;

namespace PaymentService.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PaymentsController : ControllerBase
{
    private readonly IMediator _mediator;

    public PaymentsController(IMediator mediator)
    {
        _mediator = mediator;
    }

    [HttpPost("authorize")]
    public async Task<IActionResult> Authorize([FromBody] AuthorizePaymentRequest request)
    {
        var command = new AuthorizePaymentCommand(request.BookingId, request.Amount, request.Currency ?? "USD");
        var result = await _mediator.Send(command);
        return result.Success ? Ok(result) : BadRequest(result);
    }

    [HttpPost("refund")]
    public async Task<IActionResult> Refund([FromBody] RefundPaymentRequest request)
    {
        var command = new RefundPaymentCommand(request.BookingId);
        var result = await _mediator.Send(command);
        return Ok(result);
    }
}

public class AuthorizePaymentRequest
{
    public Guid BookingId { get; set; }
    public decimal Amount { get; set; }
    public string? Currency { get; set; }
}

public class RefundPaymentRequest
{
    public Guid BookingId { get; set; }
}
