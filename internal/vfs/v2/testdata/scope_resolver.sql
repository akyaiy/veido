CREATE TABLE vfs_scopes (
    scope_key TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    owner_subject_key TEXT NOT NULL,
    updated_at DATETIME NOT NULL
);

CREATE TABLE vfs_principal_default_scopes (
    principal_type TEXT NOT NULL,
    principal_id TEXT NOT NULL,
    scope_key TEXT NOT NULL,
    PRIMARY KEY (principal_type, principal_id),
    FOREIGN KEY (scope_key) REFERENCES vfs_scopes(scope_key) ON DELETE CASCADE
);

INSERT INTO vfs_scopes (scope_key, kind, owner_subject_key, updated_at) VALUES
	('alice-home', 'user', 'user:42', '2026-01-02 03:04:05'),
	('shared-docs', 'shared', 'user:42', '2026-01-03 04:05:06'),
	('system', 'system', 'user:1', '2026-01-04 05:06:07'),
	('bob-home', 'user', 'user:7', '2026-01-05 06:07:08');

INSERT INTO vfs_principal_default_scopes (
    principal_type,
    principal_id,
    scope_key
) VALUES (
    'user',
    '42',
    'alice-home'
);
