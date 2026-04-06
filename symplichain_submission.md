# SYMPLICHAIN TECHNOLOGIES
## Software Engineering Intern Hackathon Assessment

**Candidate:** [Candidate Name]
**Date:** April 6, 2026
**Project Repo:** [GitHub Repo URL]

---

## 1. Part 1: Shared Gateway Problem (40% Weightage)

### Scenario
An external API with a hard rate limit of 3 requests per second is shared across 25 active customers. During peak hours, total demand can exceed 20 requests per second.

### Proposed Architecture: Redis-backed Fair Dispatcher
I propose a **Request Pooling and Throttling System** utilizing the existing SymFlow stack (Django, Celery, and ElastiCache/Redis).

*   **Architecture Components:**
    *   **Django API:** Receives incoming requests, validates parameters, and immediately enqueues the request into a tenant-specific Redis list. Returns a `202 Accepted` response to the client.
    *   **Redis (ElastiCache):** Serves as the high-throughput message broker hosting 25 distinct queues (one per tenant).
    *   **Dispatcher (Celery Worker):** A singular orchestrator (or a small fleet using a shared lock) that consumes from these queues.

*   **Rate Enforcement (Exactly ≤ 3/sec):**
    *   Implementation of the **Token Bucket Algorithm** via a Redis Lua script.
    *   A global bucket in Redis tracks available "tickets" (max 3).
    *   The Lua script ensures atomicity: checking for a token and decrementing the count happens in a single operation, preventing race conditions.
    *   The bucket refills at a constant rate of 3 tokens per second.

*   **Fairness Handling:**
    *   **Round-Robin Polling:** Instead of a single global queue, the Dispatcher polls the 25 tenant queues in a circular fashion (`Tenant A` -> `Tenant B` -> ... -> `Tenant Z`).
    *   It pops exactly **one** message from a tenant's queue before moving to the next.
    *   Even if `Customer A` floods 1,000 requests, `Customer B`'s single request will be served in the very next rotation (max wait time ≈ count of active tenants / 3 seconds), ensuring no single customer can starve others.

*   **Failure Handling & Retry Strategy:**
    *   **Exponential Backoff with Full Jitter:** If the external API returns a 5xx error, the task is requeued with an increasing delay (e.g., 2, 4, 8, 16 seconds).
    *   **Jitter:** Adds randomized noise to avoid "Thundering Herd" where multiple failed requests retry at the exact same millisecond.
    *   **Dead Letter Queue (DLQ):** After 5 failed attempts, the request is moved to a DLQ/PostgreSQL table for manual inspection and audit.

---

## 2. Part 2: Mobile Architecture (20% Weightage)

### Design Concept: "SymFlow Mobile"
A mobile-optimized version of the SymFlow platform focused on high-speed logging and logistics management.

*   **Interaction Model:**
    *   **Hybrid Approach:** Simple, large-target Click UI for core tasks (scanning, delivery confirmation) to minimize friction.
    *   **Agentic NLP/Voice:** Leveraging "SymAI" to allow hands-free status checks. Drivers can use push-to-talk to ask: *"What are my next 3 deliveries?"* or *"Update ETA for the Mumbai shipment to 4 PM."*
    *   **Biometrics:** FaceID/TouchID for zero-friction login.

*   **Tech Stack: React Native (Expo)**
    *   **Reasoning:**
        *   **Code Sharing:** Since SymFlow web uses React, we can share 70-80% of business logic (hooks, state management, API service layers).
        *   **Developer Velocity:** The existing team's React expertise transfers directly.
        *   **EAS (Expo Application Services):** Allows for "Over-the-Air" (OTA) updates, enabling critical bug fixes to reach drivers instantly without waiting for App Store approvals.
        *   **Native Modules:** If specific native performance is needed for camera/scanning, Expo's bare workflow allows for custom Swift/Kotlin modules while maintaining the JS-centric codebase.

---

## 3. Part 3: CI/CD and Deployment Pipeline (20% Weightage)

### Automated Workflow (.github/workflows/deploy.yml)
I have implemented a GitHub Actions workflow that automates the deployment to Staging and Production based on branch pushes.

*   **Logic:**
    *   `push to staging` -> Run Tests -> Build Frontend -> Sync S3 (Staging Bucket) -> SSH to EC2 -> Pull & Restart.
    *   `push to main` -> Run Tests -> Build Frontend -> Sync S3 (Production Bucket) -> SSH to EC2 -> Pull & Restart.

### Strategic Enhancements
*   **Dockerization:** Containerizing the Django backend and Celery workers to ensure "Environment Parity." This replaces manual `pip install` steps on EC2 with a simple `docker-compose up -d`, eliminating "works on my machine" issues.
*   **Terraform (Infrastructure as Code):** Replacing manual AWS console configuration with Terraform scripts. This allows us to spin up identical mirrors of the production environment for QA/Testing within minutes and provides a version-controlled history of infrastructure changes.

---

## 4. Part 4: Debugging (20% Weightage)

### Incident: POD (Proof of Delivery) Upload Failures at 9 AM Monday

**Step 1: Check the API Entry Point (Nginx/Django Logs)**
*   **Dashboard/Command:** `sudo tail -n 100 /var/log/nginx/error.log` on the EC2 instance.
*   **Rationale:** First determine if requests are even reaching the server. A `413 Request Entity Too Large` would mean the image size exceeded limits. A `403 Forbidden` on S3 calls would pinpoint an IAM/Credential rotation issue.

**Step 2: Inspect Async Processing (Celery Flower)**
*   **Dashboard:** Celery Flower UI (Port 5555).
*   **Rationale:** If Django returns 200/Success but the DB (RDS) doesn't update, the task is stuck in the queue. I check for "Failed" tasks or "Unacknowledged" messages. If workers are idle despite a high queue count, the worker process itself has likely crashed (OOM).

**Step 3: Downstream Service & DB Health (RDS/Bedrock)**
*   **Dashboard:** AWS CloudWatch Metrics for RDS and Bedrock.
*   **Rationale:** Monday 9 AM is peak load. I check for `ThrottlingException` on Bedrock (TPM quota hit) or `DatabaseConnections` exhaustion on RDS. High lock waits in RDS Performance Insights would explain why Celery tasks are timing out while trying to write results.

---

### Final Project Output
The interactive dashboard representing this submission is live and running at **http://localhost:5173**. 
*   **Part 1-4 Sidebar** handles navigation.
*   **Export to PDF** button in the sidebar triggers the final document generation.
*   **Copy/Download** buttons throughout the app allow for easy extraction of the YAML and code artifacts.
