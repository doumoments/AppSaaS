import urllib.request
import urllib.error
import json
import uuid
from typing import Optional, Dict, Any
from contextlib import contextmanager
from .policy import Policy
from .saga import SagaConnector

class SafeStateRuntime:
    """
    Zero-Trust Runtime Execution Wrapper for Autonomous AI Agents.
    Routes agent HTTP and tool invocations through the local ChronosAgent Guardrail.
    """

    def __init__(
        self,
        proxy_url: str = "http://127.0.0.1:4040",
        policy: Optional[Policy] = None,
        saga: Optional[SagaConnector] = None,
        api_key: Optional[str] = None
    ):
        self.proxy_url = proxy_url.rstrip("/")
        self.policy = policy or Policy()
        self.saga = saga or SagaConnector()
        self.api_key = api_key
        self.current_agent_id: Optional[str] = None
        self.current_session_id: Optional[str] = None

    @contextmanager
    def protect(self, agent_id: str, session_id: Optional[str] = None):
        """Context manager protecting an agent run within the deterministic guardrail."""
        self.current_agent_id = agent_id
        self.current_session_id = session_id or f"sess-{uuid.uuid4().hex[:8]}"
        try:
            yield self
        finally:
            self.current_agent_id = None
            self.current_session_id = None

    def call_api(
        self,
        method: str,
        target_url: str,
        payload: Optional[Dict[str, Any]] = None,
        action_name: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Executes a protected outbound call intercepted by ChronosAgent SafeState.
        """
        body_bytes = json.dumps(payload or {}).encode("utf-8")
        headers = {
            "Content-Type": "application/json",
            "X-Agent-ID": self.current_agent_id or "agent-anonymous",
            "X-Session-ID": self.current_session_id or "sess-default",
            "X-Target-URL": target_url,
        }

        if self.policy.agent_prompt:
            headers["X-Agent-Prompt"] = self.policy.agent_prompt

        if action_name:
            compensation = self.saga.get_compensation(action_name)
            if compensation:
                headers["X-Saga-Compensate"] = compensation
                headers["X-Saga-Service"] = target_url.split("/")[2] if "://" in target_url else "ExternalService"

        req = urllib.request.Request(
            f"{self.proxy_url}/proxy",
            data=body_bytes,
            headers=headers,
            method=method.upper()
        )

        try:
            with urllib.request.urlopen(req, timeout=self.policy.max_execution_time_sec) as response:
                resp_data = response.read().decode("utf-8")
                return json.loads(resp_data)
        except urllib.error.HTTPError as e:
            err_data = e.read().decode("utf-8")
            try:
                err_json = json.loads(err_data)
            except Exception:
                err_json = {"error": err_data, "status_code": e.code}
            raise GuardrailViolationError(f"Action blocked by ChronosAgent: {err_json}")
        except urllib.error.URLError as e:
            raise RuntimeConnectionError(f"Cannot connect to ChronosAgent local proxy on {self.proxy_url}: {e}")

class GuardrailViolationError(Exception):
    """Raised when an action violates the Zero-Trust runtime policy."""
    pass

class RuntimeConnectionError(Exception):
    """Raised when the local ChronosAgent daemon is not running."""
    pass
