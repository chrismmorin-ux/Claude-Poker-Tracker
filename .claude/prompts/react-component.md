# React Component Prompt Template

## Project Context
- React project with Tailwind CSS
- Component location: `src/components/ui/` or `src/components/views/`
- Import paths: Use `../../` to go up from component location
- Export style: ALWAYS use named exports (`export const ComponentName = ...`)
- Props: Receive ALL constants/functions as props (never define locally)

## Code Template
```jsx
import React from 'react';
import { Dependency } from '../../path/to/dependency';

/**
 * ComponentName - Brief description
 * @param {type} propName - Description
 */
export const ComponentName = ({
  prop1,
  prop2,
  prop3
}) => {
  return (
    <div className="tailwind-classes">
      {/* Component content */}
    </div>
  );
};
```

## Critical Rules
1. **Named exports ONLY**: `export const Foo`, never `export default Foo`
2. **Import paths**: Count directories carefully
   - From `src/components/ui/Foo.jsx` to `src/utils/bar.js` = `'../../utils/bar'`
   - From `src/components/views/Foo.jsx` to `src/utils/bar.js` = `'../../utils/bar'`
3. **Props**: If you need ACTIONS, ACTION_ABBREV, etc., they MUST be props
4. **Tailwind**: Use space-separated classes in strings, NO template literals
5. **JSDoc**: Add brief comment above component

## Example Task Format
```
Create {ComponentName} component in {location}.

Requirements:
- Import: {list all imports with exact paths}
- Props: {list all props with types}
- Functionality: {describe what it does}
- Styling: {tailwind classes to use}
- Export: Named export

Template code style:
{paste the template above}
```
