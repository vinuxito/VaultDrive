# UniversalRAG - Query Codebase Knowledge

Use this skill when you need to find code, understand implementations, or search for patterns in mrw, ia_case, importer, or universalrag projects.

## When to Use

- User asks "how does X work?" or "where is Y?"
- Need to find specific functions, classes, or patterns
- Debugging - find similar working code
- Understanding project structure before making changes

## Endpoint

```
POST http://dev-app.filemonprime.net/universalrag/api/ask.php
Content-Type: application/json
```

**Request:**
```json
{
  "question": "your question in plain English",
  "project": "mrw"
}
```

**Or GET:**
```
GET /api/ask.php?q=your+question&project=mrw
```

## Project Names

- `mrw` - Main application (2,136 PHP + JS files)
- `ia_case` - Case management system
- `importer` - Data import tools
- `universalrag` - This RAG system

## Response Includes

```json
{
  "success": true,
  "answer": "Natural language explanation",
  "sources": [{"name": "symbol", "file": "path", "line": 123}],
  "meta": {
    "confidence": 0.8,
    "found_symbols": 18
  }
}
```

## Confidence Score

- `0.8+` = High - use directly
- `0.6-0.8` = Good - likely correct
- `<0.6` = Verify with user

## Examples

**Find a function:**
```
GET /api/ask.php?q=openSearch+function&project=mrw
```
→ Returns 18 results, confidence 0.8

**Find event handlers:**
```
GET /api/ask.php?q=click+handler+search+button&project=mrw
```

**Find CSS:**
```
GET /api/ask.php?q=density+selector+css&project=mrw
```

## Other Endpoints

**Search (symbol lookup):**
```
GET /api/search.php?q=functionName&project=mrw
```

**Get context (deep dive):**
```
GET /api/get_context.php?symbol_id=xxx&project=mrw
```

## Tips

- Use project name "mrw" for most queries
- Ask in plain English: "how does theme toggle work"
- Without project param, searches ALL indexed projects
- Works for PHP, JavaScript, and CSS
