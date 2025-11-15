using System.Diagnostics;

namespace Portfolio.Models;

public class ErrorViewModel
{
    public string? RequestId { get; set; }

    public bool ShowRequestId => false; // !string.IsNullOrEmpty(RequestId) && Debugger.IsAttached;
}
