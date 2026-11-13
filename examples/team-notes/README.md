# team-notes

A small JSON API for sharing notes inside a team. It shows how to combine
sessions, role-based admin routes, routers and file downloads in Express.

## Features

- Session login (`POST /login`, `POST /logout`)
- Profile (`GET /me`, `PATCH /me`) and password reset
  (`POST /forgot-password`, `POST /reset-password`)
- Notes owned by a user and shared with collaborators
- Revisions that collaborators can save and restore
- Note export and attachment downloads
- Admin user management under `/admin`
- A simple in-memory rate limiter

## Run

```sh
node examples/team-notes
```

Then log in as one of the placeholder users:

```sh
curl -c jar -H 'Content-Type: application/json' \
  -d '{"name":"tobi","password":"ferret"}' http://localhost:3000/login
curl -b jar http://localhost:3000/notes
```
