# Client persistence

Application records are stored in IndexedDB through Dexie. React consumers read
through `usePersistentCollection`, while collection mutations update the local
view immediately and roll it back if IndexedDB rejects the write.

`MigrationGate` owns startup. It blocks the product UI until every pending
migration completes. Each entry in `migrations.ts` must explicitly set
`isDestructive`. A destructive entry also requires a user-facing warning; the
gate requires a data-backup download before it enables migration execution.

The initial migration copies valid records from the previous localStorage
formats. It deliberately leaves those source values untouched for recovery.
