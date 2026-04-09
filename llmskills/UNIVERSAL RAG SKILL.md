# UniversalRAG - Universal Codebase Knowledge Skill

**A universal skill for any LLM to query indexed codebases.**

---

## Overview

This skill enables LLMs to query indexed codebases through UniversalRAG, providing access to actual code implementations, patterns, and project-specific knowledge.

## When to Use This Skill

Activate this skill when:
- User asks about code implementation ("How does X work?")
- User asks where something is located ("Where is the Y function?")
- User asks about patterns ("How are errors handled?")
- User asks about project-specific knowledge
- Debugging code issues in indexed projects
- Need to understand existing code before making changes

## Available Projects

The following projects are currently indexed:
- **mrw** - Main application (2,136 files, 488 classes, 5,516 functions)
- **ia_case** - Case management system (630 files)
- **importer** - Data import tools (102 files)
- **universalrag** - This RAG system (27 files)

*Note: Query `/api/get_projects.php` for current project list.*

## Core Endpoint

### Ask Endpoint (Primary)

**URL:** `POST http://dev-app.filemonprime.net/universalrag/api/ask.php`

**Request:**
```json
{
  "question": "your question in plain English",
  "project": "project_name (optional)",
  "detailed": true (optional, for more code)
}
```

**Or GET:**
```
GET /api/ask.php?q=your+question&project=mrw
```

**Response:**
```json
{
  "success": true,
  "answer": "Natural language explanation",
  "sources": [
    {
      "name": "symbol_name",
      "type": "function|class|method",
      "file": "path/to/file.php",
      "line": 123,
      "description": "what it does"
    }
  ],
  "code": [
    {
      "file": "path/to/file.php",
      "lines": "100-150",
      "language": "php",
      "content": "actual source code"
    }
  ],
  "meta": {
    "pattern": "database|auth|error_handling",
    "confidence": 0.85,
    "processing_time_ms": 45
  },
  "suggestions": ["follow-up questions"]
}
```

## Query Strategy

### 1. Start with Ask Endpoint
For 90% of code questions, use the ask endpoint with a clear, specific question.

**Good questions:**
- "How does authentication work in mrw?"
- "Where is the database connection code?"
- "Show me error handling patterns"
- "Find all functions related to invoice export"

**Avoid:**
- Single words without context ("database")
- Overly broad queries ("everything")
- Questions unrelated to code ("what's the weather")

### 2. Check Confidence Score
- `0.8+` = High confidence, use directly
- `0.6-0.8` = Good confidence, likely correct
- `0.4-0.6` = Medium confidence, verify with user
- `<0.4` = Low confidence, ask clarifying questions

### 3. Use Multiple Queries
For complex questions, make multiple queries:
- Start with the main concept
- Query for specific implementations
- Get context for related functions

### 4. Leverage Suggestions
The response includes `suggestions` for relevant follow-up questions. Use these to gather more context.

## Secondary Endpoints

### Get Context (Deep Dive)

**URL:** `GET http://dev-app.filemonprime.net/universalrag/api/get_context.php`

**Parameters:**
- `symbol_id` - Symbol to get context for
- `include_related` - Include related symbols (default: true)
- `include_usage` - Include usage examples (default: true)
- `max_tokens` - Token limit (default: 4000)
- `format` - 'json' or 'llm'

**Use when:** You need complete context for a specific symbol including class information, related methods, and usage examples.

### Search (Simple)

**URL:** `GET http://dev-app.filemonprime.net/universalrag/api/search.php`

**Parameters:**
- `q` - Search query
- `project_id` - Optional project filter
- `type` - Optional type filter
- `limit` - Max results

**Use when:** Quick symbol lookup by name.

### Get Projects

**URL:** `GET http://dev-app.filemonprime.net/universalrag/api/get_projects.php`

**Use when:** Need to list available projects or get project metadata.

## Workflow

### For Code Questions

1. **Identify the project** - Which project does the question relate to?
2. **Formulate the query** - Be specific about what you need to know
3. **Query the ask endpoint** - Use clear, natural language
4. **Review the response** - Check confidence score and sources
5. **Use the code** - Base your answer on actual code from the response
6. **Cite sources** - Always include file paths and line numbers

### For Debugging

1. **Search for the error** - Query error messages or function names
2. **Find working examples** - Search for similar working code
3. **Get context** - Use get_context for deep understanding
4. **Compare** - Identify differences between working and broken code
5. **Propose fix** - Base solution on actual codebase patterns

### For Understanding Patterns

1. **Search for the pattern** - "error handling", "database query", etc.
2. **Review multiple sources** - Look at code from different files
3. **Identify the pattern** - Understand the common approach
4. **Verify** - Check confidence and number of examples

## Best Practices

### DO
- ✅ Ask specific questions in plain English
- ✅ Include project name when you know it
- ✅ Check confidence scores
- ✅ Use actual code from responses
- ✅ Cite file paths and line numbers
- ✅ Query multiple times for complex questions
- ✅ Use suggestions for follow-up

### DON'T
- ❌ Guess or make up code - always query first
- ❌ Assume patterns exist without verification
- ❌ Ignore low confidence scores
- ❌ Forget to cite sources
- ❌ Use overly vague queries

## Pattern Detection

The system automatically detects these patterns:
- **database** - Connections, queries, transactions
- **authentication** - Login, sessions, auth checks
- **error_handling** - Try-catch, error logging
- **validation** - Input sanitization, validation
- **api** - Endpoints, routes, handlers

Use these in your queries for better results.

## Error Handling

If you get no results:
1. Try broader search terms
2. Remove project filter to search all projects
3. Check if the project exists
4. Try alternative keywords

If confidence is low:
1. Ask clarifying questions
2. Search for related concepts
3. Query multiple aspects separately

## Examples

### Question: "How do I connect to database in mrw?"
```
Query: {"question": "database connection", "project": "mrw"}
Response: Found DatabaseHelper::getInstance() singleton pattern
Confidence: 0.87
```

### Question: "Where is authentication implemented?"
```
Query: {"question": "authentication login implementation"}
Response: Found AuthManager class with login methods
Confidence: 0.72
```

### Question: "Show me error handling patterns"
```
Query: {"question": "error handling try catch exception"}
Response: Found try-catch pattern in 15 files
Confidence: 0.85
```

## Integration Notes

- **Base URL:** `http://dev-app.filemonprime.net/universalrag/api/`
- **Content-Type:** `application/json`
- **Method:** POST or GET (for ask endpoint)
- **Response Format:** JSON
- **Processing Time:** Typically 50-200ms

## Limitations

- Only indexed projects can be queried
- Search accuracy depends on code indexing quality
- Very recent code changes may not be reflected
- Natural language queries work best with specific technical terms

## Troubleshooting

**Problem:** No results found
**Solution:** Try broader terms or remove project filter

**Problem:** Low confidence score
**Solution:** Ask user for more context, try related searches

**Problem:** Too many results
**Solution:** Add project filter or be more specific

**Problem:** Need more detail
**Solution:** Use `get_context.php` with specific symbol_id

## Version Info

- UniversalRAG Version: 1.0
- Last Updated: 2025-02-20
- Indexed Projects: 4 (mrw, ia_case, importer, universalrag)
- Total Files Indexed: ~2,900
- Total Symbols Indexed: ~12,000

---

## Quick Reference Card

```
ASK ENDPOINT (Use this 90% of the time):
POST http://dev-app.filemonprime.net/universalrag/api/ask.php
{"question": "your question", "project": "optional"}

GET /api/ask.php?q=your+question&project=optional

RESPONSE INCLUDES:
- answer: Natural language explanation
- sources: File paths and line numbers
- code: Actual working code
- meta.confidence: Reliability score
- suggestions: Follow-up questions

PROJECTS:
mrw, ia_case, importer, universalrag

CONFIDENCE:
0.8+ = Use it
0.6-0.8 = Probably correct
<0.6 = Verify with user

ALWAYS:
- Query before answering
- Use actual code from response
- Cite sources (file:line)
- Check confidence score
```
