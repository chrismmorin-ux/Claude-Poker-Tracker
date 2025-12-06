# Local Model Integration Guide

## Overview
This project integrates local LLM models (Qwen 2.5 Coder 7B, DeepSeek Coder 7B) to reduce Claude Code token usage for simpler coding tasks.

**Token savings**: 30-50% reduction expected for routine tasks
**Benefit**: Continue working even when hitting Claude usage limits

---

## Available Commands

### `/local [task]`
**Auto-selects best model** based on task keywords.
- Use this when you're not sure which model to use
- Qwen selected for: refactor, rename, extract, test, document
- DeepSeek selected for: generate, create, write, build

**Example:**
```
/local rename the variable mySeat to myPosition throughout the file
```

### `/local-refactor [description]`
**Forces Qwen** - Best for refactoring tasks.
- Renaming variables/functions
- Extracting functions
- Restructuring code
- Code cleanup

**Example:**
```
/local-refactor extract the card selection logic into a separate hook
```

### `/local-test [file or function]`
**Forces Qwen** - Best for generating tests.
- Unit test generation
- Test case creation
- Edge case coverage

**Example:**
```
/local-test create tests for src/utils/seatUtils.js
```

### `/local-doc [file/function]`
**Forces Qwen** - Best for documentation.
- Adding comments
- Writing JSDoc
- Explaining code
- README updates

**Example:**
```
/local-doc add JSDoc comments to useCardSelection.js
```

### `/local-code [description]`
**Forces DeepSeek** - Best for code generation.
- Creating new utilities
- Generating boilerplate
- Building templates
- Simple implementations

**Example:**
```
/local-code create a utility function to format poker chip amounts with commas
```

---

## When to Use Local Models

### ✅ GOOD for Local Models:
- **Simple refactoring**: Rename, extract functions, code cleanup
- **Testing**: Unit test generation, test cases
- **Documentation**: Comments, JSDoc, simple explanations
- **Boilerplate**: Utility functions, templates, simple components
- **Quick fixes**: Typos, obvious bugs, formatting

### ❌ NOT GOOD for Local Models (Use Claude instead):
- **Architecture design**: Planning features, system design
- **Complex debugging**: Multi-file bugs, performance issues
- **New features**: Significant functionality requiring context
- **Optimization**: Performance tuning, algorithm improvements
- **Security**: Security reviews, vulnerability analysis
- **Project-wide changes**: Multi-file refactoring, migrations

---

## Model Characteristics

### Qwen 2.5 Coder 7B
**Strengths:**
- Excellent at understanding existing code
- Great for refactoring and restructuring
- Good at test generation
- Strong code explanation abilities

**Best for:**
- Refactoring tasks
- Test writing
- Documentation
- Code analysis

### DeepSeek Coder 7B
**Strengths:**
- Excellent at generating new code
- Good at completing patterns
- Strong boilerplate generation
- Fast at simple implementations

**Best for:**
- New utility functions
- Boilerplate code
- Code generation
- Templates

---

## Setup & Troubleshooting

### Initial Setup
1. **Open LM Studio**
2. **Load a model** (Qwen 2.5 Coder 7B or DeepSeek Coder 7B)
3. **Start Server** (Developer tab → Start Server)
4. **Verify** it's running on `http://10.0.0.230:1234`

### Switching Models
To switch between Qwen and DeepSeek:
1. Stop the current server in LM Studio
2. Load the other model
3. Start the server again
4. The slash commands will automatically use the loaded model

### Common Issues

**Problem**: "LM Studio server is not responding"
- **Solution**: Open LM Studio, load a model, start the server

**Problem**: "Failed to parse response"
- **Solution**: Ensure Python is installed (required for JSON parsing)

**Problem**: Model gives poor results
- **Solution**:
  - Try the other model (Qwen vs DeepSeek)
  - For complex tasks, use Claude instead
  - Provide more context in your prompt

**Problem**: Slow responses
- **Solution**:
  - Local models take 5-30 seconds depending on task
  - This is normal for local inference
  - Consider upgrading hardware for faster inference

---

## Tips for Best Results

1. **Be specific**: Provide clear, detailed task descriptions
2. **Include context**: Mention file names, function names, or code snippets
3. **One task at a time**: Local models work best with focused requests
4. **Verify output**: Always review generated code before using it
5. **Use the right model**:
   - Qwen for refactoring/analysis
   - DeepSeek for generation
   - Claude for complex tasks

---

## Examples

### Good Usage Examples

**Refactoring:**
```
/local-refactor rename all instances of 'seat' to 'playerPosition' in TableView.jsx
```

**Testing:**
```
/local-test generate unit tests for the getSeatColor function in useSeatColor.js
```

**Documentation:**
```
/local-doc add comments explaining the logic in handleShowdownCardSelection
```

**Code Generation:**
```
/local-code create a function that converts chip counts to abbreviated format (1000 → 1K)
```

### Bad Usage Examples (Use Claude instead)

❌ `/local design a new state management architecture for the app`
✅ Use Claude for architecture decisions

❌ `/local debug why the showdown view randomly crashes`
✅ Use Claude for complex debugging

❌ `/local implement a complete statistics tracking system`
✅ Use Claude for new features

❌ `/local optimize the rendering performance of TableView`
✅ Use Claude for performance optimization

---

## Token Savings Impact

**Typical local model tasks save:**
- Simple refactoring: ~500-1000 tokens
- Test generation: ~1000-2000 tokens
- Documentation: ~300-800 tokens
- Code generation: ~500-1500 tokens

**Monthly savings estimate** (assuming 20 local tasks/day):
- 20 tasks × 1000 tokens avg = 20,000 tokens/day
- ~600,000 tokens/month saved
- Equivalent to ~$6-12 in API costs

---

## Configuration

**LM Studio Server**: `http://10.0.0.230:1234`
**Qwen Model**: `qwen2.5-coder-7b-instruct`
**DeepSeek Model**: `deepseek-coder-7b-instruct` (update when loaded)

**Scripts location**: `./scripts/`
- `call-local-model.sh` - Main API caller
- `select-model.sh` - Auto model selection
- `check-lm-studio.sh` - Health check

---

## Getting Help

If you encounter issues:
1. Check that LM Studio server is running
2. Verify the model is loaded
3. Try the other model (Qwen vs DeepSeek)
4. For complex tasks, fall back to Claude
5. Check the troubleshooting section above

**Remember**: Local models are for simpler tasks. Use Claude for anything complex!
