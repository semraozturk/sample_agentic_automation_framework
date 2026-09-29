---
name: start-servers
description: Starts the local static server(s) for the Paper Trail project so the site can be viewed at localhost. Use when the user asks to start, run, launch, or open the server(s) or the app for this project.
---

# Start servers

This project is stage A/B static HTML/CSS/JS (see `paper-trail/README.md`).
There is currently **one** server to start: a static file server rooted at
`paper-trail/`.

## Steps

1. Check if a server is already running on port 3000 before starting another
   one (look for a Node process serving that port, or an existing terminal
   already running `serve`).
2. If nothing is running, start it in the background from the `paper-trail`
   folder:

   ```bash
   npx --yes serve -l 3000
   ```

3. Confirm it started, then tell the user the URLs:
   - Home: http://localhost:3000
   - Backlog: https://github.com/semraozturk/sample_agentic_automation_framework/issues

## When this changes

Stage C (`F-API-1`) will add a real backend server. That story is not built
yet. Once it exists, add a second step here for starting it — don't invent it
early.
