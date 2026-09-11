# CommentHub Frontend

Angular application for CommentHub, styled with [MDB (Material Design Bootstrap) Free](https://mdbootstrap.com/docs/angular/) via the `mdb-angular-ui-kit` package.

## Prerequisites

- Node.js and npm (check your version with `node -v` / `npm -v`)
- No global Angular CLI install is required — all `npm` scripts below use the CLI from this project's local `node_modules`.

## Setup

From the `frontend/` folder:

```bash
npm install
```

This reads `package-lock.json` and installs the exact dependency versions used by everyone on the project (`node_modules/` itself is gitignored and never committed).

## Development server

```bash
npm start
```

Open `http://localhost:4200/` in your browser. The app rebuilds automatically when you edit source files.

## Build

```bash
npm run build
```

Production build output goes to `dist/frontend`.

## Tests

```bash
npm test
```

## Project structure

- `src/app/app.component.*` — root component (`App`), just hosts the page components below.
- `src/app/comments-page/` — mockup of the comments list page (static sample data, no API calls yet).
- `src/styles.scss` — global styles; imports Font Awesome and MDB/Bootstrap SCSS.
