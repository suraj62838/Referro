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


class JobCrudTests(APITestCase):

    def setUp(self):
        # Create two users for scoping tests
        self.user1 = User.objects.create_user(username="user1@example.com", email="user1@example.com", password="password123")
        self.user2 = User.objects.create_user(username="user2@example.com", email="user2@example.com", password="password123")

        # Obtain JWT tokens
        login_url = reverse("auth-token-obtain")
        res1 = self.client.post(login_url, {"email": "user1@example.com", "password": "password123"}, format="json")
        self.token1 = res1.data["access"]

        res2 = self.client.post(login_url, {"email": "user2@example.com", "password": "password123"}, format="json")
        self.token2 = res2.data["access"]

    def test_job_posting_crud(self):
        postings_url = "/api/job-postings/"

        # 1. Anonymous create should fail
        response = self.client.post(postings_url, {"company_name": "Acme", "role_title": "Engineer"})
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        # 2. Authenticated user1 creates a posting
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token1}")
        posting_data = {
            "company_name": "Acme",
            "role_title": "Backend Engineer",
            "location": "Remote",
            "recruiter_email": "jobs@acme.com",
            "jd_text": "We need a Django dev",
        }
        response = self.client.post(postings_url, posting_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        posting_id = response.data["id"]

        # 3. List job postings (public board) - anyone authenticated can view
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token2}")
        response = self.client.get(postings_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)

        # 4. User2 tries to update user1's posting (should fail)
        detail_url = f"{postings_url}{posting_id}/"
        response = self.client.patch(detail_url, {"location": "New York"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 5. User1 updates their own posting (should succeed)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token1}")
        response = self.client.patch(detail_url, {"location": "New York"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["location"], "New York")

        # 6. User2 tries to delete user1's posting (should fail)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token2}")
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

        # 7. User1 deletes their own posting (should succeed)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token1}")
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)

    def test_job_application_crud(self):
        apps_url = "/api/job-applications/"

        # 1. Create application for user1
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token1}")
        app_data = {
            "company_name": "Google",
            "role_title": "Frontend dev",
            "recruiter_email": "recruiter@google.com",
            "jd_text": "React experience required",
        }
        response = self.client.post(apps_url, app_data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        app_id = response.data["id"]

        # 2. User2 lists applications (should not see User1's application)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token2}")
        response = self.client.get(apps_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 0)

        # 3. User2 tries to retrieve User1's application detail (should fail with 404)
        detail_url = f"{apps_url}{app_id}/"
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

        # 4. User1 retrieves detail (succeeds)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token1}")
        response = self.client.get(detail_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["company_name"], "Google")

        # 5. User1 updates status
        response = self.client.patch(detail_url, {"status": "interview"}, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "interview")

        # 6. User1 deletes application
        response = self.client.delete(detail_url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)


class ExtractTests(APITestCase):
    """Phase 3: Tests for POST /api/job-applications/extract/."""

    EXTRACT_URL = "/api/job-applications/extract/"

    def setUp(self):
        self.user = User.objects.create_user(
            username="extractor@example.com",
            email="extractor@example.com",
            password="securePass123!",
        )
        login_url = reverse("auth-token-obtain")
        res = self.client.post(
            login_url,
            {"email": "extractor@example.com", "password": "securePass123!"},
            format="json",
        )
        self.token = res.data["access"]

    def _auth(self):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

    # ── Text extraction tests ─────────────────────────────────

    def test_text_with_email(self):
        """Text containing an email returns both jd_text and recruiter_email."""
        self._auth()
        jd = "We are hiring! Contact us at jobs@acme.com for details."
        res = self.client.post(self.EXTRACT_URL, {"text": jd}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["jd_text"], jd)
        self.assertEqual(res.data["recruiter_email"], "jobs@acme.com")

    def test_text_without_email(self):
        """Text without an email returns jd_text with empty recruiter_email."""
        self._auth()
        jd = "Join our team — no contact info here."
        res = self.client.post(self.EXTRACT_URL, {"text": jd}, format="json")
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data["jd_text"], jd)
        self.assertEqual(res.data["recruiter_email"], "")

    def test_no_input(self):
        """Neither text nor file → 400."""
        self._auth()
        res = self.client.post(self.EXTRACT_URL, {}, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_unauthenticated(self):
        """Unauthenticated request → 401."""
        res = self.client.post(
            self.EXTRACT_URL, {"text": "hello"}, format="json"
        )
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    # ── File extraction tests ─────────────────────────────────

    def test_pdf_upload(self):
        """PDF file upload → returns extracted text + email."""
        import io

        from PyPDF2 import PdfWriter
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas

        # Create a real PDF with text
        buf = io.BytesIO()
        c = canvas.Canvas(buf, pagesize=letter)
        c.drawString(72, 720, "Backend Engineer at Acme Corp")
        c.drawString(72, 700, "Contact: hiring@acmecorp.com")
        c.save()
        buf.seek(0)

        from django.core.files.uploadedfile import SimpleUploadedFile

        pdf_file = SimpleUploadedFile(
            "job.pdf", buf.read(), content_type="application/pdf"
        )

        self._auth()
        res = self.client.post(
            self.EXTRACT_URL, {"file": pdf_file}, format="multipart"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("jd_text", res.data)
        self.assertTrue(len(res.data["jd_text"]) > 0)
        # The email should be detected from the extracted text
        self.assertEqual(res.data["recruiter_email"], "hiring@acmecorp.com")

    def test_docx_upload(self):
        """DOCX file upload → returns extracted text + email."""
        import io

        import docx

        doc = docx.Document()
        doc.add_paragraph("Frontend Developer at Widget Inc.")
        doc.add_paragraph("Apply at apply@widgetinc.com")
        buf = io.BytesIO()
        doc.save(buf)
        buf.seek(0)

        from django.core.files.uploadedfile import SimpleUploadedFile

        docx_file = SimpleUploadedFile(
            "job.docx",
            buf.read(),
            content_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        )

        self._auth()
        res = self.client.post(
            self.EXTRACT_URL, {"file": docx_file}, format="multipart"
        )
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("Widget", res.data["jd_text"])
        self.assertEqual(res.data["recruiter_email"], "apply@widgetinc.com")

    def test_unsupported_file_type(self):
        """Uploading an unsupported file type → 400."""
        from django.core.files.uploadedfile import SimpleUploadedFile

        txt_file = SimpleUploadedFile(
            "notes.txt", b"just a text file", content_type="text/plain"
        )
        self._auth()
        res = self.client.post(
            self.EXTRACT_URL, {"file": txt_file}, format="multipart"
        )
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("Unsupported", res.data["detail"])


class Phase4AITests(APITestCase):
    """Phase 4: Tests for Job Description generation and email drafting."""

    def setUp(self):
        self.user = User.objects.create_user(
            username="ai_user@example.com",
            email="ai_user@example.com",
            password="securePass123!",
        )
        login_url = reverse("auth-token-obtain")
        res = self.client.post(
            login_url,
            {"email": "ai_user@example.com", "password": "securePass123!"},
            format="json",
        )
        self.token = res.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {self.token}")

    def test_generate_jd_endpoint(self):
        """POST /api/job-postings/generate-jd/ creates a JD with AI service."""
        url = "/api/job-postings/generate-jd/"
        data = {
            "role_title": "React Developer",
            "seniority": "Senior",
            "key_skills": "React, TypeScript, CSS",
            "notes": "Remote, small team",
        }
        res = self.client.post(url, data, format="json")
        if res.status_code != status.HTTP_200_OK:
            print("Generate JD response:", res.data)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("jd_text", res.data)
        self.assertIn("React Developer", res.data["jd_text"])
        self.assertIn("Senior", res.data["jd_text"])
        self.assertIn("React, TypeScript, CSS", res.data["jd_text"])

    def test_generate_jd_missing_role(self):
        """POST /api/job-postings/generate-jd/ fails if role is missing."""
        url = "/api/job-postings/generate-jd/"
        data = {
            "seniority": "Senior",
            "key_skills": "React",
        }
        res = self.client.post(url, data, format="json")
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)

    def test_draft_email_endpoint(self):
        """POST /api/job-applications/{id}/draft-email/ drafts email for application."""
        from api.models import JobApplication
        app = JobApplication.objects.create(
            user=self.user,
            company_name="Stripe",
            role_title="Backend Dev",
            jd_text="Python knowledge required.",
            recruiter_email="jobs@stripe.com",
        )
        url = f"/api/job-applications/{app.id}/draft-email/"
        res = self.client.post(url, format="json")
        if res.status_code != status.HTTP_200_OK:
            print("Draft email response:", res.data)
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn("subject", res.data)
        self.assertIn("body", res.data)
        self.assertIn("Stripe", res.data["subject"])
        self.assertIn("Backend Dev", res.data["subject"])



