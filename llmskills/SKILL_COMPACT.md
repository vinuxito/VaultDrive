# Codebase Knowledge (UniversalRAG)

Query indexed codebases to find actual implementations, patterns, and project-specific knowledge.

## When to Activate

User asks about:
- How code works ("How does X work?")
- Where code is located ("Where is Y function?")
- Code patterns ("How are errors handled?")
- Debugging existing code
- Understanding project structure

## Core Command

**Ask the codebase:**
```
POST http://localhost/universalrag/api/ask.php
{"question": "your question", "project": "project_name"}
```

**Or GET:**
```
GET /api/ask.php?q=your+question
```

## Response Contains

- `answer` - Explanation
- `sources` - File paths and line numbers
- `code` - Actual working code
- `meta.confidence` - Reliability (0-1)
- `suggestions` - Follow-up questions

## Available Projects

mrw | ia_case | importer | universalrag

## Confidence Guide

- 0.8+ = High confidence, use directly
- 0.6-0.8 = Good, probably correct
- <0.6 = Low, verify with user

## Workflow

1. User asks code question
2. Query ask endpoint
3. Review response (check confidence)
4. Use actual code from response
5. Cite sources (file:line)

## Best Practices

- ✅ Query before answering
- ✅ Use actual code from response
- ✅ Cite file paths
- ✅ Check confidence
- ❌ Don't make up code

## Quick Examples

```
{"question": "database connection", "project": "mrw"}
{"question": "authentication implementation"}
{"question": "error handling patterns"}
{"question": "invoice export PDF"}
```

## Other Endpoints

- `/api/get_context.php?symbol_id=ID` - Deep dive
- `/api/search.php?q=term` - Quick lookup
- `/api/get_projects.php` - List projects
