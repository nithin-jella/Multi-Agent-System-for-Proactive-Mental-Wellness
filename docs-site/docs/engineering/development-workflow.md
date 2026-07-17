---
sidebar_position: 2
id: development-workflow
title: Development Setup Guide
---

# Development Setup Guide

## Hot-Reloading with Docker Compose

This project includes a `docker-compose.override.yml` file that automatically enables development mode with hot-reloading for both frontend and backend services.

### Quick Start

1. **Start services in development mode:**

 ```bash
 docker compose up
 ```

 The override file is automatically loaded and enables:
 - Backend hot-reload on code changes
 - Frontend hot-reload with Next.js dev server
 - Volume mounts for instant code updates

2. **Rebuild only when dependencies change:**

 ```bash
 # Only needed when package.json or requirements.txt changes
 docker compose up --build
 ```

3. **View logs:**

 ```bash
 docker compose logs -f backend
 docker compose logs -f frontend
 ```

### What's Different in Development Mode?

**Backend:**

- Gunicorn runs with `--reload` flag
- Source code mounted as volume (`./backend:/app`)
- Single worker for faster restarts
- Extended timeout (120s)

**Frontend:**

- Next.js dev server (`npm run dev`)
- Source code mounted as volume (`./frontend:/app`)
- Node modules preserved in anonymous volume
- File watching optimized for Docker

### Disable Development Mode

To run in production mode (as defined in `docker-compose.yml`):

```bash
# Temporarily disable override
docker compose -f docker-compose.yml up

# Or rename the override file
mv docker-compose.override.yml docker-compose.override.yml.disabled
docker compose up
```

### Troubleshooting

**Changes not reflecting:**

- Ensure you're editing files in the correct directory
- Check if file watching is working: `docker compose logs -f backend`
- On Windows, file watching might be slower due to WSL/Docker Desktop

**Performance issues:**

- Reduce number of files being watched
- Use `.dockerignore` to exclude unnecessary files
- Consider increasing Docker Desktop resources

**Permission errors:**

- On Linux, you might need to match UID/GID in containers
- Use `chown` to fix file ownership if needed

### Tips

- Keep `docker-compose.override.yml` in `.gitignore` if you have personal settings
- Use `docker compose down -v` to clean up volumes when switching modes
- Backend changes reflect in 1-2 seconds
- Frontend changes reflect almost instantly with Next.js Fast Refresh
