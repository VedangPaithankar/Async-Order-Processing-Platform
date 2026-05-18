# Async Order Processing Platform

## Overview

A full-stack asynchronous order processing system built with:

- React
- Express
- PostgreSQL
- Prisma
- Redis
- BullMQ
- Docker

---

## Architecture

Client
↓
React Frontend
↓
Express API
↓
PostgreSQL

Express API
↓
Redis Queue
↓
Worker
↓
Dead Letter Queue

---

## Features

### Authentication
- Signup
- Login
- JWT Authentication
- Protected Routes

### Orders
- Create Order
- View Orders
- Ownership checks

### Async Processing
- Redis Queue
- Worker processing
- Retry mechanism
- Exponential backoff
- Idempotency

### Reliability
- Structured logging
- Failure classification
- Dead Letter Queue

### Infrastructure
- Dockerized services
- PostgreSQL
- Redis

---

## Run Project

```bash
docker compose up --build
```

Apply Prisma:

```bash
docker compose exec backend npx prisma db push
```

Frontend:

```text
http://localhost:5173
```