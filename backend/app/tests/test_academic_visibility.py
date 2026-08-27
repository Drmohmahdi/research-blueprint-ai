"""
Regression guard: the legacy academic-visibility router is intentionally
retired, not merely untested.

`academic_visibility.py` (operating on the superseded `AcademicIdentityProfile`
/`AcademicChannel` tables — fully backfilled into `UnifiedAcademicProfile`/
`AcademicIdentifier` by migration 8322d39fc0aa) was mounted in main.py with
zero frontend consumer, and both its endpoints trusted a client-supplied
`user_id` with no check against the caller's own identity: `GET
/profile/{user_id}` would read (and auto-create) ANY user's profile by path
parameter alone, and `POST /profile` would overwrite ANY user's profile via
`body.userId` — a full cross-user, cross-tenant IDOR (read and write), live
on the API regardless of UI reachability. The prior version of this test file
even asserted a `test_different_users_isolated` case that actually
*demonstrated* the vulnerability (successfully reading a second user's
profile through the same session) while mislabeling it as isolation.

Fixed by un-mounting the router entirely in main.py, rather than patching an
endpoint nobody uses — the active, correctly-scoped equivalent is
`academic_foundation.py`'s `/profile/me` (`GET`) and `/profile/upsert`
(`POST`), which only ever operate on `context.user.id`. This test asserts the
retirement holds.
"""
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_legacy_academic_visibility_router_is_not_mounted():
    r_get = client.get("/api/academic-visibility/profile/any-user-id")
    assert r_get.status_code == 404

    r_post = client.post("/api/academic-visibility/profile", json={"userId": "any-user-id"})
    assert r_post.status_code == 404
