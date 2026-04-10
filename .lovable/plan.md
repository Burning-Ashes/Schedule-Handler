
## Zen Scheduler Dashboard

Recreate the task management dashboard from the screenshot as a single-page app with static/mock data.

### Layout
- **Left Sidebar**: "Focused Sanctuary / THE DIGITAL CURATOR" branding, green "+ New Task" button, vertical nav (Today, Planned, Human Tasks, Automations) with active indicator line, user avatar + name ("Alex Rivera / Deep Work Mode") at bottom
- **Top Bar**: "Zen Scheduler" title, search input with icon, notification bell + settings gear icons
- **Main Content Area** (two-column layout):
  - **Left column**: "Today's Rhythm" heading with subtitle, categorized task cards
  - **Right column**: Progress widget with 65% circle, progress bar (0-100%), Time Focus (4h 12m) and Tasks Left (3 Units) stat boxes

### Task Cards
- **Human Tasks** (green category badge):
  1. "Weekly Strategy Sync" – with person icon, time (10:30 AM), Priority tag
  2. "Deep Work: Architecture Design" – with edit icon, time (2:00 PM), Focus Mode tag
- **Automation Review** (red category badge):
  1. "API Integration Failure" – red-bordered card with robot icon, "Action Required" warning, "FIX NOW" button

### Styling
- Soft light background with subtle gradient/rounded container
- Green accent color for active nav, buttons, progress bar
- Cards with left-colored borders (green for human tasks, red/coral for automation)
- Clean, modern typography with clear hierarchy
- All using Tailwind CSS with the existing design system, adding custom green/coral colors
