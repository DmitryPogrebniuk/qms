# API Documentation

## Overview

The Cisco QMS API is a REST API built with NestJS, providing endpoints for:
- Authentication & authorization
- Recording search & streaming
- Quality evaluations
- Coaching management
- QA sampling
- Admin functions

## Authentication

All endpoints require a Bearer JWT token in the `Authorization` header:

```
Authorization: Bearer <jwt_token>
```

Obtain a token via `/api/auth/verify-token` using a Keycloak token.

## Endpoints

### Authentication

#### Verify Token
```
POST /api/auth/verify-token
Content-Type: application/json

{
  "token": "<keycloak_token>"
}

Response 200:
{
  "jwt": "<internal_jwt_token>"
}
```

### Users

#### Get Current User Profile
```
GET /api/users/profile
Authorization: Bearer <jwt>

Response 200:
{
  "id": "user-id",
  "username": "john.doe",
  "email": "john@example.com",
  "role": "SUPERVISOR",
  "teamCodes": ["BILLING"]
}
```

#### Get All Agents
```
GET /api/users/agents
Authorization: Bearer <jwt>

Response 200:
[
  {
    "id": "agent-id",
    "agentId": "agent001",
    "fullName": "John Smith",
    "email": "john@example.com"
  }
]
```

#### Get Team Members
```
GET /api/users/teams/:teamCode/members
Authorization: Bearer <jwt>

Response 200:
[
  {
    "id": "agent-id",
    "agentId": "agent001",
    "fullName": "John Smith",
    "activeFlag": true
  }
]
```

### Recordings

#### Search Recordings
```
GET /api/recordings/search?page=1&pageSize=20&dateFrom=2024-01-01&dateTo=2024-01-31
Authorization: Bearer <jwt>

Query Parameters:
- page: number (1-based)
- pageSize: number (1-100)
- dateFrom: ISO 8601 date
- dateTo: ISO 8601 date
- agentIds: comma-separated IDs
- teamCodes: comma-separated codes
- csqs: comma-separated queue names
- query: free-text search

Response 200:
{
  "data": [
    {
      "id": "rec-id",
      "mediasenseRecordingId": "MS_001",
      "agentId": "agent001",
      "teamCode": "BILLING",
      "startTime": "2024-01-15T10:30:00Z",
      "durationSeconds": 900,
      "ani": "5551234567",
      "wrapUpReason": "ISSUE_RESOLVED"
    }
  ],
  "total": 1250,
  "page": 1,
  "pageSize": 20,
  "totalPages": 63
}
```

#### Get Recording Details
```
GET /api/recordings/:id
Authorization: Bearer <jwt>

Response 200:
{
  "id": "rec-id",
  "mediasenseRecordingId": "MS_001",
  "agentId": "agent001",
  "teamCode": "BILLING",
  "startTime": "2024-01-15T10:30:00Z",
  "endTime": "2024-01-15T10:45:00Z",
  "durationSeconds": 900,
  "ani": "5551234567",
  "dnis": "18003334444",
  "csq": "BILLING_QUEUE",
  "wrapUpReason": "ISSUE_RESOLVED",
  "evaluation": {
    "id": "eval-id",
    "status": "SUBMITTED",
    "totalScore": 9.5
  }
}
```

#### Stream Recording
```
GET /api/recordings/:id/stream
Authorization: Bearer <jwt>
Range: bytes=0-1023 (optional)

Response 206 Partial Content / 200 OK:
[audio stream]
```

### Chats

#### Search Chats
```
GET /api/chats/search?page=1&pageSize=20&dateFrom=2024-01-01
Authorization: Bearer <jwt>

Response 200:
{
  "data": [ ... ],
  "total": 450,
  "page": 1,
  "pageSize": 20,
  "totalPages": 23
}
```

#### Get Chat Details
```
GET /api/chats/:id
Authorization: Bearer <jwt>

Response 200:
{
  "id": "chat-id",
  "agentId": "agent001",
  "startTime": "2024-01-15T10:30:00Z",
  "endTime": "2024-01-15T10:45:00Z",
  "participants": ["agent001", "customer"],
  "messages": [
    {
      "timestamp": "2024-01-15T10:30:15Z",
      "senderName": "agent001",
      "messageText": "Hello, how can I help?"
    }
  ]
}
```

### Evaluations

#### Create Evaluation
```
POST /api/evaluations
Authorization: Bearer <jwt>
Content-Type: application/json
Requires: QA, SUPERVISOR, or ADMIN role

{
  "recordingId": "rec-id",
  "scorecardTemplateId": "template-id",
  "agentId": "agent001",
  "teamCode": "BILLING",
  "responses": [
    {
      "questionId": "q-1",
      "score": 5,
      "comment": "Excellent",
      "isNA": false
    }
  ]
}

Response 201:
{
  "id": "eval-id",
  "status": "DRAFT",
  "totalScore": null
}
```

#### Submit Evaluation
```
PUT /api/evaluations/:id/submit
Authorization: Bearer <jwt>

Response 200:
{
  "id": "eval-id",
  "status": "SUBMITTED",
  "submittedAt": "2024-01-15T11:00:00Z",
  "totalScore": 4.5
}
```

#### Get Agent Evaluations
```
GET /api/evaluations/agent/:agentId?page=1&pageSize=20
Authorization: Bearer <jwt>

Response 200:
{
  "data": [
    {
      "id": "eval-id",
      "status": "SUBMITTED",
      "totalScore": 4.5,
      "createdAt": "2024-01-15T11:00:00Z"
    }
  ],
  "total": 15,
  "page": 1,
  "pageSize": 20
}
```

### Coaching

#### Create Coaching Plan
```
POST /api/coaching/evaluations/:evaluationId/plans
Authorization: Bearer <jwt>
Requires: SUPERVISOR or ADMIN role
Content-Type: application/json

{
  "actionItems": [
    {
      "description": "Improve call greeting",
      "dueDate": "2024-02-15"
    }
  ]
}

Response 201:
{
  "id": "plan-id",
  "status": "ACTIVE",
  "actionItems": [ ... ]
}
```

#### Get Agent Coaching Plans
```
GET /api/coaching/agents/:agentId?page=1&pageSize=20
Authorization: Bearer <jwt>

Response 200:
{
  "data": [
    {
      "id": "plan-id",
      "status": "ACTIVE",
      "actionItems": [ ... ]
    }
  ],
  "total": 3,
  "page": 1,
  "pageSize": 20
}
```

### Sampling

#### Get QA Worklist
```
GET /api/sampling/qa-worklist?page=1&pageSize=20
Authorization: Bearer <jwt>
Requires: QA role

Response 200:
{
  "data": [
    {
      "id": "sample-id",
      "recordingId": "rec-id",
      "agentId": "agent001",
      "sampledAt": "2024-01-15T06:00:00Z"
    }
  ],
  "total": 42,
  "page": 1,
  "pageSize": 20
}
```

#### Mark Sampling Record Evaluated
```
PATCH /api/sampling/records/:id/evaluated
Authorization: Bearer <jwt>

Response 200:
{
  "id": "sample-id",
  "evaluatedAt": "2024-01-15T11:00:00Z"
}
```

## Error Responses

### 400 Bad Request
```json
{
  "statusCode": 400,
  "message": "Invalid request parameters",
  "error": "Bad Request"
}
```

### 401 Unauthorized
```json
{
  "statusCode": 401,
  "message": "Invalid or expired token",
  "error": "Unauthorized"
}
```

### 403 Forbidden
```json
{
  "statusCode": 403,
  "message": "Insufficient permissions",
  "error": "Forbidden"
}
```

### 404 Not Found
```json
{
  "statusCode": 404,
  "message": "Resource not found",
  "error": "Not Found"
}
```

### 500 Internal Server Error
```json
{
  "statusCode": 500,
  "message": "Internal server error",
  "error": "Internal Server Error"
}
```

## Rate Limiting

- API: 100 requests/minute per user
- Streaming: 3 concurrent streams per user
- Search: 10 requests/second per user

## Pagination

All list endpoints support pagination:
- `page`: 1-based page number (default: 1)
- `pageSize`: items per page (default: 20, max: 100)

Response includes:
- `data`: Array of items
- `total`: Total number of items
- `page`: Current page
- `pageSize`: Items per page
- `totalPages`: Total number of pages
