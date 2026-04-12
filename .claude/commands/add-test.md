Write tests for the file or module specified by the user: $ARGUMENTS

1. Read the source file to understand its exports, behavior, and edge cases
2. Create or update the corresponding test file in `src/__tests__/`
3. Write comprehensive tests covering:
   - Happy path for each exported function/component
   - Edge cases (empty inputs, boundary values, error states)
   - Integration with dependencies (mock external deps, test real logic)
4. Run `npm test` to verify all tests pass
5. Report coverage of the module
