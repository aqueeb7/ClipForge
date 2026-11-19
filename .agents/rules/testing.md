# Testing Rules

1. **Test-Driven & Incremental**:
   - Write tests alongside each module and specification milestone.
   - Run unit tests on all data transformations, schema validations, boundary algorithms, and error scenarios.

2. **Fixtures**:
   - Use small synthetic test fixtures generated programmatically or mocked.
   - Never use massive real-world footage (e.g. 19GB files) in automated test suites.

3. **Coverage**:
   - Test happy paths and boundary conditions (e.g. 0 duration, partial final clip, negative audio offset, unicode paths, spaces in paths).
