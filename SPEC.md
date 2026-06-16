# Task Mark Dashboard - Specification

## Concept & Vision
A real-time task tracking dashboard where users can view their assigned work stages, mark them complete, and instantly see the next stage. The interface feels like a professional command center - clean, focused, and action-oriented. Every interaction provides immediate visual feedback, making task completion feel satisfying and progress obvious.

## Design Language

### Aesthetic Direction
Industrial-modern command center aesthetic - think mission control meets Kanban board. Clean lines, purposeful color coding, and clear visual hierarchy.

### Color Palette
- **Primary**: #3B82F6 (Action Blue) - main actions, selected states
- **Success**: #10B981 (Complete Green) - completed stages, success states
- **Warning**: #F59E0B (Pending Orange) - upcoming stages, warnings
- **Danger**: #EF4444 (Overdue Red) - overdue tasks, alerts
- **Background**: #0F172A (Dark Navy) - main background
- **Surface**: #1E293B (Slate) - cards and panels
- **Surface Light**: #334155 - hover states, borders
- **Text Primary**: #F8FAFC - headings, important text
- **Text Secondary**: #94A3B8 - labels, descriptions

### Typography
- **Primary Font**: Inter (Google Fonts)
- **Headings**: 600-700 weight, tracking tight
- **Body**: 400-500 weight, relaxed line height
- **Monospace elements**: JetBrains Mono for IDs and codes

### Spatial System
- Base unit: 4px
- Card padding: 24px
- Gap between cards: 16px
- Section spacing: 32px

### Motion Philosophy
- Stage completion: confetti burst + checkmark animation (400ms)
- Card transitions: slide + fade (300ms ease-out)
- Loading states: skeleton pulse animation
- Hover: subtle scale (1.02) + shadow lift

## Layout & Structure

### Main Layout
1. **Header Bar** - User info, connection status, last sync time
2. **Stats Overview** - Cards showing total tasks, completed today, pending, overdue
3. **Task Grid** - Cards for each unique task showing all stages
4. **Stage Detail Modal** - Expanded view with form link

### Responsive Strategy
- Desktop: 3-column task grid
- Tablet: 2-column grid
- Mobile: Single column, collapsible stages

## Features & Interactions

### Core Features
1. **User Identification** - Login with email to see only assigned tasks
2. **Stage Visualization** - Horizontal stepper showing all stages per task
3. **Stage Completion** - Click stage to mark complete, opens Google Form link
4. **Real-time Sync** - Auto-refresh every 30 seconds, manual refresh button
5. **Progress Tracking** - Visual progress bar per task

### Interaction Details
- **Click Stage**: Opens confirmation → Opens Google Form link in new tab
- **Mark Complete**: After form submission, click "Mark as Done" → Stage turns green → Next stage highlights
- **Hover Stage**: Shows planned date, step name, link preview
- **Overdue Indicator**: Red border + pulse animation on overdue stages

### Data Flow
1. App loads → Fetches data from Google Apps Script endpoint
2. Filters by user's Final Doer Email
3. Groups tasks by Unique Key
4. Displays all stages with current status
5. On completion → Updates sheet via Apps Script API

## Component Inventory

### UserBadge
- Shows user avatar (initials), name, email
- States: logged in, logged out, loading

### StatsCard
- Icon, label, value, trend indicator
- States: normal, loading (skeleton), empty

### TaskCard
- Header: Client name, Unique Key, progress percentage
- Body: Stage stepper horizontal
- Footer: Next planned date, action button
- States: has overdue, all complete, in progress, not started

### StageStep
- Circle with step number/check
- Step name below
- States: completed (green check), current (blue pulse), pending (gray), overdue (red border)

### StageModal
- Full step details
- Google Form link button
- Mark complete button
- Close button

### ConnectionStatus
- Online/offline indicator
- Last sync timestamp
- Refresh button

## Technical Approach

### Frontend
- React + TypeScript + Vite
- Tailwind CSS for styling
- Zustand for state management
- fetch API for data calls

### Backend (Google Apps Script)
- Web App endpoint for reading tasks
- Web App endpoint for updating completion
- Returns JSON data
- Handles CORS

### Data Model
```
Task {
  uniqueKey: string
  clientName: string
  plannedDate: string
  step: string
  how: string
  doerName: string
  link: string
  forPC: string
  doerEmail: string
  finalDoerEmail: string
  finalDoerName: string
  status: "pending" | "in_progress" | "completed"
  completedAt?: string
}
```

### API Endpoints
- GET /tasks?email={userEmail} - Fetch user's tasks
- POST /complete - Mark stage complete {uniqueKey, step, completedBy}