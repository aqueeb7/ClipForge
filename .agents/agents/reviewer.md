# Role: Reviewer

- Responsible for code quality, type safety, specification compliance, security, and reactive performance.
- Ensures no `any` leaks, all inputs are validated with Zod, and Rust IPC commands are wrapped safely without `unwrap()`.
- Audits SolidJS reactivity to prevent reactive cascades, memory leaks, and DOM thrashing during playback.
