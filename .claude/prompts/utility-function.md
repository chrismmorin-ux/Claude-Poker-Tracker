# Utility Function Prompt Template

## Project Context
- Pure JavaScript utility functions
- Location: `src/utils/`
- Export style: Named exports only
- Dependencies: Receive as parameters (dependency injection pattern)

## Code Template
```javascript
/**
 * functionName - Brief description
 * @param {type} param1 - Description
 * @param {type} param2 - Description
 * @returns {type} - Description
 */
export const functionName = (param1, param2, dependencies) => {
  // Implementation
  return result;
};
```

## Critical Rules
1. **Pure functions**: No side effects, same input = same output
2. **Dependency injection**: Pass constants/functions as parameters
3. **Named exports**: `export const foo`, never `export default foo`
4. **JSDoc**: Document all parameters and return type
5. **Error handling**: Return sensible defaults, don't throw unless critical

## Good For Local Models
✅ Data transformations
✅ Array/object manipulation
✅ String formatting
✅ Simple calculations
✅ Validation helpers

## Bad For Local Models
❌ Complex business logic
❌ State management
❌ API calls
❌ Side effects

## Example Task Format
```
Create utility function {functionName} in src/utils/{fileName}.js

Purpose: {what it does}

Parameters:
- param1 ({type}): {description}
- param2 ({type}): {description}

Returns: {type} - {description}

Example usage:
{show example}

Edge cases to handle:
- {list edge cases}
```
