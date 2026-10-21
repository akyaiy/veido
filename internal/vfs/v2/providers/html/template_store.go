package html

import (
	"context"
	"database/sql"
	"errors"
)

func (s *SQLiteStore) InstallTemplate(ctx context.Context, input NewTemplatePackage) (*ApplicationTemplate, error) {
	if input.SiteID <= 0 || input.TemplateKey == "" || input.Version == "" || input.Entrypoint == "" ||
		len(input.PackageDigest) != 64 || len(input.ManifestDigest) != 64 || len(input.ManifestJSON) == 0 || len(input.Assets) == 0 {
		return nil, ErrInvalidTemplate
	}
	var packageID int64
	err := s.withTx(ctx, func(tx *sql.Tx) error {
		result, err := tx.ExecContext(ctx, `
			INSERT INTO html_template_packages (
				site_id, template_key, version, entrypoint,
				package_digest, manifest_digest, manifest_json
			) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			input.SiteID, input.TemplateKey, input.Version, input.Entrypoint,
			input.PackageDigest, input.ManifestDigest, input.ManifestJSON,
		)
		if err != nil {
			return err
		}
		packageID, err = result.LastInsertId()
		if err != nil {
			return err
		}
		for _, asset := range input.Assets {
			if asset.Path == "" || asset.ContentType == "" || len(asset.Digest) != 64 {
				return ErrInvalidTemplate
			}
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO html_template_blobs(digest, size, data)
				VALUES (?, ?, ?)
				ON CONFLICT(digest) DO NOTHING`, asset.Digest, len(asset.Data), asset.Data); err != nil {
				return err
			}
			var storedSize int64
			if err := tx.QueryRowContext(ctx, `SELECT size FROM html_template_blobs WHERE digest = ?`, asset.Digest).Scan(&storedSize); err != nil {
				return err
			}
			if storedSize != int64(len(asset.Data)) {
				return ErrInvalidTemplate
			}
			if _, err := tx.ExecContext(ctx, `
				INSERT INTO html_template_assets(package_id, path, content_type, digest, size)
				VALUES (?, ?, ?, ?, ?)`, packageID, asset.Path, asset.ContentType, asset.Digest, len(asset.Data)); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, classifyStoreError(err)
	}
	return s.templateByID(ctx, input.SiteID, packageID)
}

func (s *SQLiteStore) ListTemplateKeys(ctx context.Context, siteID int64) ([]string, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT DISTINCT template_key
		FROM html_template_packages
		WHERE site_id = ?
		ORDER BY template_key`, siteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	keys := make([]string, 0)
	for rows.Next() {
		var key string
		if err := rows.Scan(&key); err != nil {
			return nil, err
		}
		keys = append(keys, key)
	}
	return keys, rows.Err()
}

func (s *SQLiteStore) ListTemplateVersions(ctx context.Context, siteID int64, templateKey string) ([]ApplicationTemplate, error) {
	rows, err := s.db.QueryContext(ctx, templateSelect+`
		WHERE site_id = ? AND template_key = ?
		ORDER BY created_at, id`, siteID, templateKey)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]ApplicationTemplate, 0)
	for rows.Next() {
		item, err := scanTemplate(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (s *SQLiteStore) TemplateByKeyVersion(ctx context.Context, siteID int64, templateKey, version string) (*ApplicationTemplate, error) {
	return scanTemplate(s.db.QueryRowContext(ctx, templateSelect+`
		WHERE site_id = ? AND template_key = ? AND version = ?`, siteID, templateKey, version))
}

func (s *SQLiteStore) templateByID(ctx context.Context, siteID, packageID int64) (*ApplicationTemplate, error) {
	return scanTemplate(s.db.QueryRowContext(ctx, templateSelect+`
		WHERE site_id = ? AND id = ?`, siteID, packageID))
}

const templateSelect = `SELECT
	id, site_id, template_key, version, entrypoint,
	package_digest, manifest_digest, manifest_json, created_at
FROM html_template_packages `

func scanTemplate(row rowScanner) (*ApplicationTemplate, error) {
	var item ApplicationTemplate
	if err := row.Scan(&item.ID, &item.SiteID, &item.TemplateKey, &item.Version, &item.Entrypoint,
		&item.PackageDigest, &item.ManifestDigest, &item.ManifestJSON, &item.CreatedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrTemplateNotFound
		}
		return nil, classifyStoreError(err)
	}
	return &item, nil
}

func (s *SQLiteStore) ListTemplateAssets(ctx context.Context, packageID int64) ([]TemplateAsset, error) {
	rows, err := s.db.QueryContext(ctx, templateAssetSelect+`
		WHERE a.package_id = ? ORDER BY a.path`, packageID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := make([]TemplateAsset, 0)
	for rows.Next() {
		item, err := scanTemplateAsset(rows)
		if err != nil {
			return nil, err
		}
		items = append(items, *item)
	}
	return items, rows.Err()
}

func (s *SQLiteStore) TemplateAssetByPath(ctx context.Context, packageID int64, assetPath string) (*TemplateAsset, error) {
	return scanTemplateAsset(s.db.QueryRowContext(ctx, templateAssetSelect+`
		WHERE a.package_id = ? AND a.path = ?`, packageID, assetPath))
}

const templateAssetSelect = `SELECT
	a.package_id, a.path, a.content_type, a.digest, a.size, b.data
FROM html_template_assets a
JOIN html_template_blobs b ON b.digest = a.digest `

func scanTemplateAsset(row rowScanner) (*TemplateAsset, error) {
	var item TemplateAsset
	if err := row.Scan(&item.PackageID, &item.Path, &item.ContentType, &item.Digest, &item.Size, &item.Data); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrTemplateAssetNotFound
		}
		return nil, classifyStoreError(err)
	}
	return &item, nil
}
