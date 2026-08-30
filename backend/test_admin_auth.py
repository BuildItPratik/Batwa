import unittest
import os
from unittest.mock import patch

from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from services.admin_auth import (
    AdminAuthError,
    AdminAuthNotConfigured,
    issue_admin_token,
    require_admin,
    verify_admin_token,
)


class AdminAuthTests(unittest.TestCase):
    def test_configured_pin_issues_a_token_that_can_be_verified(self):
        with patch.dict(os.environ, {"BATWA_ADMIN_PIN": "2468"}, clear=False):
            token, expires_in = issue_admin_token("2468")

        self.assertGreater(expires_in, 0)
        verify_admin_token(token)

    def test_wrong_pin_is_rejected(self):
        with patch.dict(os.environ, {"BATWA_ADMIN_PIN": "2468"}, clear=False):
            with self.assertRaises(AdminAuthError):
                issue_admin_token("1357")

    def test_missing_pin_does_not_create_an_open_admin(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaises(AdminAuthNotConfigured):
                issue_admin_token("2468")

    def test_missing_or_invalid_bearer_token_is_rejected(self):
        with self.assertRaises(HTTPException) as missing:
            require_admin(None)
        self.assertEqual(missing.exception.status_code, 401)

        with self.assertRaises(HTTPException) as invalid:
            require_admin(HTTPAuthorizationCredentials(scheme="Bearer", credentials="forged"))
        self.assertEqual(invalid.exception.status_code, 401)


if __name__ == "__main__":
    unittest.main()
