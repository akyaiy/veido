CREATE TABLE vfs_scopes (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL,
    name TEXT NOT NULL,
    owner_subject_key TEXT NOT NULL,
    UNIQUE(kind, name)
);

CREATE TABLE vfs_principal_default_scopes (
    principal_type TEXT NOT NULL,
    principal_id TEXT NOT NULL,
    provider TEXT NOT NULL,
    connection_name TEXT NOT NULL,
    scope_id TEXT NOT NULL,
    PRIMARY KEY (principal_type, principal_id, provider, connection_name),
    FOREIGN KEY (scope_id) REFERENCES vfs_scopes(id) ON DELETE CASCADE
);

INSERT INTO vfs_scopes (id, kind, name, owner_subject_key) VALUES
    ('scope-user-42', 'user', 'alice-home', 'user:42'),
    ('scope-shared', 'shared', 'shared-docs', 'user:42');

INSERT INTO vfs_principal_default_scopes (
    principal_type,
    principal_id,
    provider,
    connection_name,
    scope_id
) VALUES (
    'user',
    '42',
    'filesystem',
    'main',
    'scope-user-42'
);
