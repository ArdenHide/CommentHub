# CommentHub

A comment board built with ASP.NET Core + HotChocolate GraphQL on the backend and an Angular
single-page app on the frontend: threaded comments, sorting and pagination, an image CAPTCHA,
file attachments, and live updates pushed to every open browser tab as new comments arrive.

**Live demo:** http://100.53.5.62

## Features

- **Threaded comments** — top-level comments with nested replies, each with a name, email,
  optional home page, and an auto-generated avatar.
- **Sorting & pagination** — sort by user name, email, or date, ascending or descending; the
  top-level list is paginated server-side.
- **Rich text formatting** — a small WYSIWYG toolbar (Bold, Italic, Code, Link) lets you format
  a comment by selecting text and clicking a button, the same way a chat app would; the editor
  restricts output to four safe tags (`<a>`, `<code>`, `<i>`, `<strong>`), which the server
  re-validates and sanitizes independently.
- **Image CAPTCHA** — required on every new comment/reply to deter spam.
- **Attachments** — a single image (resized server-side) or a small text file per comment.
- **Live updates** — new top-level comments appear for every visitor in real time over
  SignalR, without a page reload; a "N new comments" indicator appears instead when you're not
  on the page/sort view where they'd show up automatically.
- **Masked emails** — addresses are shown as `a***@example.com` in the UI.

## Tech stack

**Backend** — ASP.NET Core (.NET 10), [HotChocolate](https://chillicream.com/docs/hotchocolate)
GraphQL server, EF Core with Npgsql (PostgreSQL), FluentValidation, HtmlSanitizer,
SixLabors.ImageSharp for attachment resizing, SignalR for realtime push, and an in-process
`Channel`-backed background worker that fans out comment events to connected clients.

**Frontend** — Angular (standalone components, signals), Apollo Angular for GraphQL,
`@microsoft/signalr` for the realtime client, MDB Angular UI Kit (Bootstrap-based) for styling,
and Vitest for unit tests.

**Infrastructure** — Docker Compose (PostgreSQL, a one-shot EF Core migration runner, the API,
and an Nginx-served frontend that reverse-proxies GraphQL/SignalR/REST calls to the API).

## Getting started (Docker Compose)

This is the quickest way to run the whole stack:

```bash
docker compose up --build
```

This starts PostgreSQL, applies EF Core migrations, then starts the API and the frontend. Once
everything is healthy, open **http://localhost**. GraphQL, SignalR and REST endpoints are all
reverse-proxied by the frontend's Nginx container, so the browser only ever talks to port 80.

A [pgweb](https://github.com/sosedoff/pgweb) instance is also started, bound to
`127.0.0.1:8081`, for inspecting the database from the host without a desktop client.

## Local development

Running backend and frontend separately (with hot reload) is faster while iterating.

**Backend** — from `backend/`, start just PostgreSQL (and pgweb) with:

```bash
docker compose up -d postgres pgweb
```

Apply migrations (requires the `dotnet-ef` tool: `dotnet tool install --global dotnet-ef`) and
run the API:

```bash
dotnet ef database update --project src/CommentHub.Database/CommentHub.Database.csproj --startup-project src/CommentHub.Api/CommentHub.Api.csproj
dotnet run --project src/CommentHub.Api
```

The API listens on `http://localhost:5203` (see `backend/docker-compose.yml` and
`appsettings.Development.json`; `SeedDevData: true` seeds some sample comments on first run).

**Frontend** — from `frontend/`:

```bash
npm install
npm start
```

Serves the app on `http://localhost:4200`, configured (see `src/environments/environment.development.ts`)
to talk to the API above.

## Running tests

```bash
# backend — integration tests against a real Postgres via Testcontainers, so Docker must be running
cd backend
dotnet test

# frontend — unit tests via Vitest
cd frontend
npm test
```

## Project structure

```
backend/
  src/
    CommentHub.Api/        ASP.NET Core host: Program.cs, REST endpoints, appsettings
    CommentHub.Database/   EF Core DbContext, entities, migrations, dev data seeding
    CommentHub.GraphQL/    GraphQL schema (queries/mutations/types), realtime pipeline,
                           attachment/captcha services, HTML validation & sanitization
  tests/
    CommentHub.GraphQL.Tests/  xUnit + Testcontainers integration tests

frontend/
  src/app/
    comments-page/         the comment board: list, pagination, sorting, the comment form
                            (WYSIWYG editor), replies, attachments, the SignalR client
    site-header/            "New comment" entry point
  nginx.conf                reverse-proxy config used in the production Docker image

docs/
  NET_Entity_framework_SPA_application_comments.pdf   the original assignment brief
```

## Notes

- A standalone SQL/DB-schema export file is intentionally not included — the schema is fully
  defined by the EF Core migrations under `backend/src/CommentHub.Database/Migrations`, which are
  the source of truth and are applied automatically by `docker compose up`.
