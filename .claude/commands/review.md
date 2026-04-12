Review all staged or uncommitted changes for quality, correctness, and potential issues.

1. Run `git diff` and `git diff --staged` to see all changes
2. Review each changed file for:
   - Correctness: does the logic do what it's supposed to?
   - Type safety: any potential runtime errors?
   - Security: injection, XSS, or auth bypass risks?
   - Performance: unnecessary re-renders, O(n^2) loops, memory leaks?
   - Test coverage: are the changes covered by tests?
3. Provide a structured review with:
   - Issues found (critical, warning, suggestion)
   - Files that need test updates
   - Recommended improvements
