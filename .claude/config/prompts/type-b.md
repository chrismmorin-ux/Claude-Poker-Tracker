# Type B: Template Fill Tasks

## Description

Type B tasks are **template fill** operations - the most reliable task type for local model execution. Success rate: **>80% when template is clear**.

Characteristics:
- Fill in predefined structure
- Replace placeholders with values
- Follow strict format rules
- Minimal creative decisions
- Deterministic output

## When to Use edit_strategy: "template_fill"

Use this strategy when:
- Output structure is completely predefined
- Placeholders are clearly marked
- Replacement values are explicitly provided
- Format rules are unambiguous
- No logic decisions required

## Examples of Type B Tasks

1. **Generate function from template with specific parameters**
   - Template: Function skeleton with parameter placeholders
   - Values: Specific parameter names, types, return value
   - Output: Complete, runnable function

2. **Fill test template with test cases**
   - Template: Test suite structure with case slots
   - Values: Input/output pairs, test assertions
   - Output: Complete test file

3. **Create config file from standard structure**
   - Template: Configuration schema with default values
   - Values: Specific settings for this deployment
   - Output: Valid configuration file

4. **Generate API endpoint from specification**
   - Template: Route handler skeleton
   - Values: HTTP method, path, request/response types
   - Output: Complete endpoint handler

## Template Variables (Required)

Mark template areas for substitution with double curly braces:

- `{{TASK_TITLE}}` - Task name or identifier
- `{{FILE_PATH}}` - Target file location
- `{{template_structure}}` - Complete expected output structure with all placeholders
- `{{placeholder_values}}` - Key-value pairs for all {{...}} markers in template
- `{{constraints}}` - Formatting rules, syntax requirements, and validation rules
- `{{CONTEXT}}` - Background information or requirements

## How to Execute Type B Tasks

### Step 1: Provide Complete Template
```
Output structure MUST be fully specified, e.g.:
  ```
  function {{FUNCTION_NAME}}({{PARAMETERS}}) {
    // TODO: {{FUNCTION_BODY}}
    return {{RETURN_VALUE}};
  }
  ```
```

### Step 2: List All Placeholder Values
```json
{
  "{{FUNCTION_NAME}}": "calculateScore",
  "{{PARAMETERS}}": "player, hands",
  "{{FUNCTION_BODY}}": "logic to compute poker hand strength",
  "{{RETURN_VALUE}}": "numeric score"
}
```

### Step 3: Specify Format Rules
- Indentation: 2 spaces, 4 spaces, or tabs
- Line endings: LF or CRLF
- Character encoding: UTF-8
- Syntax requirements: Any language-specific rules

### Step 4: Provide Examples (Optional)
Show 1-2 completed examples of similar outputs to clarify expectations.

## Success Criteria

✓ File created with all placeholders replaced
✓ No extraneous content or creative additions
✓ Format strictly matches template specification
✓ All syntax rules followed exactly
✓ Test command passes (if provided)

## Common Type B Mistakes

❌ **Ambiguous placeholders** - Use clear, unique marker names
❌ **Incomplete templates** - Every decision point must be pre-specified
❌ **Creative freedom** - Don't give "interpretation" instructions
❌ **Format ambiguity** - Be explicit about spacing, indentation, line breaks
❌ **Missing value mappings** - Provide values for EVERY placeholder

## Escalation

If local model creates output that:
- Modifies template structure
- Makes creative decisions
- Adds interpretive content
- Fails syntax checks

Then **immediately re-decompose** as:
- Type A task (direct edit of existing content)
- Multiple Type B tasks (simpler templates)
- Type C task with explicit constraints (if unavoidable)

## Assignment

This task type should be assigned to: **local:qwen** or **local:claude-small**

Reliability: 80-90% on well-specified templates
