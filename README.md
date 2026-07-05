# Social Media Platform

A modern, high-performance full-stack social media platform built using **Django** (backend with Django Channels for WebSockets) and **Next.js** (frontend with React & Tailwind CSS).

## Tech Stack
- **Backend**: Django, Django REST Framework, Django Channels (WebSockets)
- **Frontend**: Next.js (App Router, Tailwind CSS, JavaScript)
- **Database**: PostgreSQL
- **Caching & Message Broker**: Redis
- **Containerization**: Docker & Docker Compose
- **Media Hosting**: Cloudinary / S3
- **Email Services**: SendGrid

---

## Directory Structure
- `/backend` - Django REST API and WebSocket Channels layer.
- `/frontend` - Next.js client-side application.
- `docker-compose.yml` - Docker setup for running the entire stack locally.
- `docker-compose.dev.yml` - Docker compose overrides for hot-reloading development.

---

## Getting Started

### Prerequisites
Make sure you have the following installed:
1. [Docker & Docker Compose](https://www.docker.com/)
2. [Python 3.10+](https://www.python.org/) (for local development without Docker)
3. [Node.js 18+](https://nodejs.org/) (for local development without Docker)

---

### Running with Docker (Recommended)

1. Clone the repository and navigate to the project root.
2. Create and fill out `.env` files in both the `backend/` and `frontend/` directories (refer to `.env.example` templates in each folder).
3. Build and launch all services:
   ```bash
   docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
   ```
4. Access the applications:
   - **Frontend App**: `http://localhost:3000`
   - **Backend API**: `http://localhost:8000/api/v1/`
   - **WebSocket Endpoint**: `ws://localhost:8000/ws/v1/`
   - **Admin Console**: `http://localhost:8000/admin/`

---

### Running Manually for Local Development

#### 1. Backend Setup
1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Activate your virtual environment:
   * **Windows**: `venv\Scripts\activate`
   * **macOS/Linux**: `source venv/bin/activate`
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Run database migrations:
   ```bash
   python manage.py migrate
   ```
5. Start the development server (runs with Daphne for ASGI/WebSockets support):
   ```bash
   daphne -p 8000 core.asgi:application
   ```

#### 2. Frontend Setup
1. Navigate to the `frontend/` directory:
   ```bash
   cd ../frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Next.js development server:
   ```bash
   npm run dev
   ```
4. Access the web app at `http://localhost:3000`.

#### 3. Celery Setup (Background Tasks)
Celery handles background notifications, email setups, and feed fanout activities. Ensure Redis is running, then:
1. Navigate to the `backend/` directory and activate the virtual environment:
   ```bash
   cd backend
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```
2. Start the Celery worker:
   ```bash
   celery -A core worker --loglevel=info -P solo
   ```

---

### Git & GitHub Workflow

Use the following commands to commit and push modifications to your repository:
1. Check changed files:
   ```bash
   git status
   ```
2. Stage all modifications:
   ```bash
   git add .
   ```
3. Commit with a meaningful message:
   ```bash
   git commit -m "Your descriptive message"
   ```
4. Push changes to GitHub:
   ```bash
   git push origin master
   ```
