from typing import Dict, Optional, Callable, Any

class SagaConnector:
    """Saga Pattern Compensation Engine connector for third-party API reversals."""
    
    def __init__(self):
        self._registry: Dict[str, str] = {}
        self._handlers: Dict[str, Callable[[Any], Any]] = {}

    def register(self, action: str, compensate: str, handler: Optional[Callable[[Any], Any]] = None):
        """Registers a compensating action for an executed action."""
        self._registry[action] = compensate
        if handler:
            self._handlers[compensate] = handler

    def get_compensation(self, action: str) -> Optional[str]:
        return self._registry.get(action)

    def execute_handler(self, compensate_action: str, payload: Any):
        if compensate_action in self._handlers:
            return self._handlers[compensate_action](payload)
        return None
