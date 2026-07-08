from django.contrib.auth.models import User
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APITestCase


class AuthTests(APITestCase):

    def test_auth_flow(self):
        """
        Verify signup -> login -> accessing authenticated endpoint.
        Uses /api/health/ (open) and a dummy test endpoint to check auth requirements.
        """
        signup_url = reverse("auth-signup")
        login_url = reverse("auth-token-obtain")
        refresh_url = reverse("auth-token-refresh")

        # 1. Signup a new user
        signup_data = {"email": "testuser@example.com", "password": "securePass123!"}
        response = self.client.post(signup_url, signup_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn("access", response.data)
        self.assertIn("refresh", response.data)
        self.assertEqual(response.data["user"]["email"], "testuser@example.com")

        # 2. Try to signup with the same email (should fail)
        response_duplicate = self.client.post(
            signup_url, signup_data, format="json"
        )
        self.assertEqual(response_duplicate.status_code, status.HTTP_400_BAD_REQUEST)

        # 3. Login with the credentials
        login_data = {"email": "testuser@example.com", "password": "securePass123!"}
        response = self.client.post(login_url, login_data, format="json")
        if response.status_code != status.HTTP_200_OK:
            print("Login failed with errors:", response.data)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
        access_token = response.data["access"]
        refresh_token = response.data["refresh"]

        # 4. Access a protected endpoint without token (should fail with 401)
        # Since we don't have another model endpoint yet, let's call the admin or a dummy
        # view, or we can use the client credentials to test simple jwt.
        # Actually, let's define a simple protected test view for this purpose.
        protected_url = "/api/auth/test-protected/"
        response = self.client.get(protected_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # 5. Access the protected endpoint with valid token (should succeed with 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {access_token}")
        response = self.client.get(protected_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["message"], "authenticated")

        # 6. Test Refresh Token
        self.client.credentials()  # Clear credentials
        refresh_data = {"refresh": refresh_token}
        response = self.client.post(refresh_url, refresh_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)
