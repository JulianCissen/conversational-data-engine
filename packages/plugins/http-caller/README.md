# HTTP Caller Plugin

A plugin for the Conversational Data Engine that makes HTTP requests to external APIs and maps responses to conversation slots.

## Features

- Supports all HTTP methods (GET, POST, PUT, PATCH, DELETE)
- URL and request body interpolation with slot values
- Response mapping to conversation slots
- Configurable headers and timeout
- Support for nested response fields using dot notation

## Installation

1. Build the plugin:
   ```bash
   npm install
   npm run build
   ```

2. Copy the plugin to the backend's plugins directory:
   ```bash
   cp -r dist packages/backend/plugins/http-caller/
   cp plugin.json packages/backend/plugins/http-caller/
   ```

## Configuration

Add the plugin to your Service Blueprint:

```json
{
  "id": "my-service",
  "name": "My Service",
  "fields": [...],
  "plugins": [
    {
      "id": "http-caller",
      "config": {
        "method": "GET",
        "url": "https://api.example.com/user/{user_id}",
        "headers": {
          "Authorization": "Bearer YOUR_TOKEN",
          "Content-Type": "application/json"
        },
        "responseMapping": {
          "name": "user_name",
          "email": "user_email",
          "address.city": "user_city"
        },
        "timeout": 5000
      }
    }
  ],
  "hooks": {
    "onFieldValidated": ["http-caller"]
  }
}
```

## Configuration Options

### Required

- **`method`** (string): HTTP method to use (GET, POST, PUT, PATCH, DELETE)
- **`url`** (string): API endpoint URL. Supports slot interpolation using `{slot_name}` syntax
- **`responseMapping`** (object): Map API response fields to conversation slot IDs

### Optional

- **`headers`** (object): HTTP headers to include in the request
- **`body`** (object): Request body for POST/PUT/PATCH requests. Supports slot interpolation
- **`timeout`** (number): Request timeout in milliseconds (default: 5000)

## Slot Interpolation

The plugin supports slot interpolation in both the URL and request body:

```json
{
  "url": "https://api.example.com/user/{user_id}/orders/{order_id}",
  "body": {
    "userId": "{user_id}",
    "timestamp": "{submission_date}"
  }
}
```

Given conversation data:
```json
{
  "user_id": "12345",
  "order_id": "67890",
  "submission_date": "2025-11-24"
}
```

The request will be:
- URL: `https://api.example.com/user/12345/orders/67890`
- Body: `{ "userId": "12345", "timestamp": "2025-11-24" }`

## Response Mapping

Use dot notation to access nested response fields:

```json
{
  "responseMapping": {
    "user.profile.name": "user_name",
    "user.profile.email": "user_email",
    "user.address.city": "user_city"
  }
}
```

For an API response like:
```json
{
  "user": {
    "profile": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "address": {
      "city": "New York"
    }
  }
}
```

The plugin will create these slot updates:
```json
{
  "user_name": "John Doe",
  "user_email": "john@example.com",
  "user_city": "New York"
}
```

## Example Use Cases

### 1. User Data Lookup

After collecting a user ID, fetch their profile information:

```json
{
  "id": "user-lookup",
  "config": {
    "method": "GET",
    "url": "https://api.example.com/users/{user_id}",
    "headers": {
      "Authorization": "Bearer YOUR_API_KEY"
    },
    "responseMapping": {
      "name": "user_name",
      "email": "user_email",
      "department": "user_department"
    }
  }
}
```

### 2. Address Validation

After collecting a postal code, fetch city and state:

```json
{
  "id": "address-lookup",
  "config": {
    "method": "GET",
    "url": "https://api.example.com/postal-codes/{postal_code}",
    "responseMapping": {
      "city": "city",
      "state": "state",
      "country": "country"
    }
  }
}
```

### 3. Data Submission

On conversation completion, submit data to an external system:

```json
{
  "hooks": {
    "onConversationComplete": ["submit-data"]
  },
  "plugins": [
    {
      "id": "submit-data",
      "config": {
        "method": "POST",
        "url": "https://api.example.com/submissions",
        "headers": {
          "Authorization": "Bearer YOUR_API_KEY",
          "Content-Type": "application/json"
        },
        "body": {
          "userId": "{user_id}",
          "formData": {
            "transport": "{transport_type}",
            "age": "{age}"
          }
        },
        "responseMapping": {
          "submissionId": "submission_id"
        }
      }
    }
  ]
}
```

## Error Handling

If the HTTP request fails, the plugin will throw an error that blocks the conversation flow. The error message includes:

- HTTP status code and message (if available)
- Network error details (if connection failed)

## License

MIT
