from typing import List, Optional
from dataclasses import dataclass, field

@dataclass
class Policy:
    """Security Policy configuration for an AI Agent execution session."""
    max_execution_time_sec: int = 30
    allowed_domains: List[str] = field(default_factory=lambda: [
        "api.github.com",
        "api.stripe.com",
        "api.openai.com",
        "api.anthropic.com"
    ])
    blocked_syscalls: List[str] = field(default_factory=lambda: [
        "sys_raw_socket",
        "execve",
        "unlink",
        "rmdir"
    ])
    auto_rollback_on_error: bool = True
    agent_prompt: Optional[str] = None
