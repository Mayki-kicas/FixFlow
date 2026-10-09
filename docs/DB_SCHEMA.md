# Schema BDD (ERD)

Base de reference: `app/prisma/schema.prisma`.

## Entites principales

- `User`
- `Team`
- `TicketStatus`
- `Ticket`
- `Location`
- `EquipmentCategory`
- `Equipment`
- `Group` + tables de liaison (`GroupMember`, `GroupTeam`)
- `TicketSubscription`
- `Attachment`
- `ChatMessage`
- `Maintainer`
- `IncidentReport`
- `Notification`
- Abonnements categories (`GroupCategorySubscription`, `UserCategorySubscription`)

## ERD

```mermaid
erDiagram
  USER {
    string id PK
    string ldapId UK
    string email UK
    string displayName
    enum role
  }

  TEAM {
    string id PK
    string name
  }

  TICKET_STATUS {
    string id PK
    string name
    int order
    boolean isFinal
    string teamId FK
  }

  LOCATION {
    string id PK
    string code UK
    string name
  }

  EQUIPMENT_CATEGORY {
    string id PK
    string name
  }

  EQUIPMENT {
    string id PK
    string name
    string refCode UK
    string categoryId FK
    string locationId FK
    string teamId FK
  }

  TICKET {
    string id PK
    int ticketNumber UK
    string title
    string description
    string statusId FK
    string equipmentId FK
    string requesterId FK
    string teamId FK
    string locationId FK
    string maintainerId FK
    datetime openedAt
    datetime closedAt
    datetime dueDate
    boolean isArchived
  }

  CHAT_MESSAGE {
    string id PK
    string ticketId FK
    string authorId FK
    string content
  }

  ATTACHMENT {
    string id PK
    enum type
    string ticketId FK
    string chatMessageId FK
    string uploadedById FK
    bytes content
  }

  MAINTAINER {
    string id PK
    string name
  }

  INCIDENT_REPORT {
    string id PK
    string locationId FK
    string createdById FK
    string subject
    datetime dateTime
  }

  GROUP_ENTITY {
    string id PK
    string name
  }

  GROUP_MEMBER {
    string id PK
    string groupId FK
    string userId FK
  }

  GROUP_TEAM {
    string id PK
    string groupId FK
    string teamId FK
  }

  TICKET_SUBSCRIPTION {
    string id PK
    string ticketId FK
    string userId FK
  }

  GROUP_CATEGORY_SUBSCRIPTION {
    string id PK
    string groupId FK
    string categoryId FK
  }

  USER_CATEGORY_SUBSCRIPTION {
    string id PK
    string userId FK
    string categoryId FK
  }

  NOTIFICATION {
    string id PK
    string userId FK
    enum type
    string title
    boolean isRead
  }

  USER ||--o{ TICKET : "requester"
  TEAM ||--o{ TICKET : "owns"
  TICKET_STATUS ||--o{ TICKET : "status"
  EQUIPMENT ||--o{ TICKET : "target"
  LOCATION ||--o{ TICKET : "context"
  MAINTAINER ||--o{ TICKET : "assigned"

  TEAM ||--o{ TICKET_STATUS : "workflow"
  TEAM ||--o{ EQUIPMENT : "responsible"
  LOCATION ||--o{ EQUIPMENT : "located"
  EQUIPMENT_CATEGORY ||--o{ EQUIPMENT : "classifies"

  TICKET ||--o{ CHAT_MESSAGE : "discussion"
  USER ||--o{ CHAT_MESSAGE : "author"
  USER ||--o{ ATTACHMENT : "uploadedBy"
  TICKET ||--o{ ATTACHMENT : "ticketAttachments"
  CHAT_MESSAGE ||--o{ ATTACHMENT : "messageAttachments"

  GROUP_ENTITY ||--o{ GROUP_MEMBER : "memberships"
  USER ||--o{ GROUP_MEMBER : "belongsTo"
  GROUP_ENTITY ||--o{ GROUP_TEAM : "linkedTeams"
  TEAM ||--o{ GROUP_TEAM : "linkedGroups"

  TICKET ||--o{ TICKET_SUBSCRIPTION : "subscriptions"
  USER ||--o{ TICKET_SUBSCRIPTION : "subscribed"

  GROUP_ENTITY ||--o{ GROUP_CATEGORY_SUBSCRIPTION : "categoryAccess"
  EQUIPMENT_CATEGORY ||--o{ GROUP_CATEGORY_SUBSCRIPTION : "forGroups"
  USER ||--o{ USER_CATEGORY_SUBSCRIPTION : "categoryAccess"
  EQUIPMENT_CATEGORY ||--o{ USER_CATEGORY_SUBSCRIPTION : "forUsers"

  USER ||--o{ INCIDENT_REPORT : "createdBy"
  LOCATION ||--o{ INCIDENT_REPORT : "location"

  USER ||--o{ NOTIFICATION : "inbox"
```

