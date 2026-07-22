from types import SimpleNamespace

from app.api.v1 import help as help_api
from app.core.security import get_current_user


def test_help_routes_require_authenticated_user():
    help_routes = {
        route.path: route
        for route in help_api.router.routes
        if route.path in {"/help/guides", "/help/guides/{slug}"}
    }

    assert set(help_routes) == {"/help/guides", "/help/guides/{slug}"}
    for route in help_routes.values():
        assert any(dependency.call is get_current_user for dependency in route.dependant.dependencies)


def test_help_routes_still_delegate_to_service_for_authenticated_user(monkeypatch):
    user = SimpleNamespace(user_id="USR00000001")
    calls = []

    monkeypatch.setattr(
        help_api.help_service,
        "list_guides",
        lambda: calls.append("list") or {"guides": []},
    )
    monkeypatch.setattr(
        help_api.help_service,
        "get_guide",
        lambda slug: calls.append(("get", slug)) or {"slug": slug},
    )

    assert help_api.list_guides(_current_user=user) == {"guides": []}
    assert help_api.get_guide("getting-started", _current_user=user) == {"slug": "getting-started"}
    assert calls == ["list", ("get", "getting-started")]
