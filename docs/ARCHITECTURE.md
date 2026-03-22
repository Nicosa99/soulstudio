# SoulTune Ecosystem Architecture & Deployment Guide

This document outlines the current technical architecture, deployment strategy, and file structures for the **SoulTune Ecosystem** (specifically the main website/blog). 

When building new tools (like **SoulStudio** for creators), this documentation ensures that the core infrastructure remains untouched, stable, and clearly separated.

---

## 1. Core Stack

*   **Framework:** Next.js (React)
*   **Language:** TypeScript
*   **Styling:** Tailwind CSS
*   **Content Management:** MDX (Markdown with JSX)
*   **Database:** PostgreSQL (via Prisma ORM)
*   **Deployment:** Docker & Docker Compose
*   **Proxy/Routing:** Nginx

---

## 2. Server & Deployment Architecture

The entire application runs on a single host server using **Docker Compose**.

### 2.1 The Docker Compose Setup
The `docker-compose.yml` (located in `/root/projects/soultune/`) orchestrates the following services:

1.  **`web` (Next.js App):** 
    *   Builds from `apps/web/Dockerfile`.
    *   Runs the main website and API routes.
    *   Exposed internally on port `3000`.
2.  **`nginx` (Reverse Proxy):**
    *   Listens on ports `80` and `443` (HTTP/HTTPS).
    *   Routes public traffic (e.g., `soultune.app`) to the internal `web` container.
    *   Handles SSL certificates.
3.  **`db` (PostgreSQL):**
    *   Maintains user data, stats, and future dynamic content.
    *   Persisted via Docker volumes.

### 2.2 Content Publishing Workflow (ISR & Bind Mounts)

We recently moved away from API-based publishing to a highly stable **File-System + ISR (Incremental Static Regeneration)** approach.

*   **The Mount:** The local folder `/root/projects/soultune/apps/web/content/blog` is bind-mounted directly into the `web` container at `/app/apps/web/content/blog`.
*   **How it Works:** Any `.mdx` file written to this local directory is instantly visible to the Next.js server inside the container.
*   **Revalidation:** Next.js is configured with `revalidate = 60`. It checks this folder every 60 seconds. If a new file is detected, the site (and the RSS feed) updates automatically.
*   **Why this matters for SoulStudio:** If SoulStudio needs to publish to the main blog, it simply needs file-system write access to that specific `content/blog` directory. It does *not* need to touch the Docker containers or the Next.js source code.

---

## 3. Directory Structure

The project uses a monorepo-style structure (nx based):

```text
/root/projects/soultune/
├── apps/
│   ├── web/                     # Main Next.js Website & Blog
│   │   ├── content/blog/        # MDX files (Bind-mounted, live publishing)
│   │   ├── public/              # Static assets (images, icons)
│   │   ├── src/                 # React components, pages, api routes
│   │   └── Dockerfile           # Web container definition
│   ├── api/                     # Dedicated Backend API (NestJS/Express)
│   └── ...e2e/                  # End-to-end testing setups
├── prisma/                      # Database schemas and migrations
├── nginx/                       # Nginx configuration (default.conf)
├── docker-compose.yml           # Core orchestration
└── CLAWDBOT.md                  # Publishing instructions for AI agents
```

---

## 4. Expanding the Ecosystem: Introducing "SoulStudio"

If you are building **SoulStudio** (a creator platform/dashboard), the golden rule is **Separation of Concerns**. SoulStudio should not break the main website.

### 4.1 Recommended Architecture for SoulStudio

1.  **Separate App Directory:**
    Build SoulStudio in a new directory, e.g., `/root/projects/soulstudio/`. Do not mix its source code with `/soultune/apps/web`.
2.  **Separate Container:**
    Give SoulStudio its own `Dockerfile` and run it as a separate container in a new or existing `docker-compose.yml`.
3.  **Routing via Nginx:**
    Update the existing Nginx configuration (`/root/projects/soultune/nginx/default.conf`) to route traffic based on subdomains or paths.
    *   `soultune.app` -> routes to `soultune_web_1` (Port 3000)
    *   `studio.soultune.app` -> routes to `soulstudio_app_1` (Port X)
4.  **Database Access:**
    If SoulStudio needs to access the main database, connect it to the existing PostgreSQL container (`soultune_db_1`) using the internal Docker network, rather than spinning up a second database.

### 4.2 Safe Integration Points
*   **Content Creation:** SoulStudio can generate `.mdx` files and save them directly to `/root/projects/soultune/apps/web/content/blog/`. The main website will pick them up automatically.
*   **Asset Management:** If creators upload audio/images via SoulStudio, they should be saved to an external bucket (like AWS S3) or a dedicated shared volume, rather than inside the Next.js `public` folder, to prevent bloating the main app.

---

## 5. Emergency Commands

If the main site goes down or needs a hard reset, run these from `/root/projects/soultune`:

*   **View Logs:** `docker logs soultune_web_1 --tail 100`
*   **Restart Web Only:** `docker-compose restart web`
*   **Full Rebuild (Use only if dependencies/code change):** `docker-compose up -d --build`
*   **Check running services:** `docker ps`
