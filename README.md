# 🎯 Mission Control

**Mr. Anderson's Private AI Agent Interface**

A password-protected dashboard where you can assign tasks to Mr. Anderson and watch him execute in real-time.

## Features

- 🔐 **Password Protected** - Only you can access
- 🤖 **Mr. Anderson Avatar** - Real-time status (Idle/Executing)
- ⚡ **Instant Execution** - Tasks execute when you submit
- 📊 **Task History** - See all completed missions
- 🎯 **Smart Routing** - Keywords route to specialized handlers

## Getting Started

### 1. Install Dependencies
```bash
cd mission-control
npm install
```

### 2. Set Environment Variables
```bash
cp .env.example .env.local
```

Edit `.env.local` and set:
```
MISSION_PASSWORD=your-secure-password
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Access Mission Control
Open http://localhost:3000/dashboard

## Usage

### Add a Task
Type a task and press "Send Mission". Keywords are detected:
- `research X` → Research and analyze
- `post to X` → Draft social media post
- `blog about X` → Write blog content
- `build X` → Generate code
- `fix X` → Debug and repair
- `deploy X` → Deploy to production
- `schedule X` → Create cron job
- `integrate X` → Connect APIs
- `analyze X` → Run analysis

### Watch Execution
- Mr. Anderson's avatar pulses when executing
- Status shows current task
- Results appear in mission history

## Deployment

### Vercel (Recommended)
1. Push to GitHub
2. Import in Vercel
3. Add `MISSION_PASSWORD` environment variable
4. Deploy!

### Environment Variables
| Name | Required | Description |
|------|----------|-------------|
| `MISSION_PASSWORD` | Yes | Access code for login |
| `NODE_ENV` | No | Set to `production` for prod |

## Architecture

```
Mission Control
├── /login - Password protection
├── /dashboard - Main interface
│   ├── Agent Avatar (status indicator)
│   ├── Task Input
│   └── Task History
└── /api
    ├── /login - Authentication
    ├── /tasks - Task CRUD
    └── /execute - Task execution engine
```

## Tech Stack

- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **JWT** - Secure authentication
- **CSS Variables** - Dark theme

---

*Built by Mr. Anderson 🕶️*
