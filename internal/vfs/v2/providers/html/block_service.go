package html

import (
	"github.com/akyaiy/veido/internal/common"
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"io"
	"strings"
)

type BlockFolder struct {
	Key     string        `json:"key"`
	Name    string        `json:"name"`
	Folders []BlockFolder `json:"folders,omitempty"`
	Blocks  []string      `json:"blocks,omitempty"`
}
type BlockTreeDocument struct {
	Revision int64         `json:"revision"`
	Folders  []BlockFolder `json:"folders"`
}
type CreateBlockRequest struct {
	SiteID                                    int64
	BlockKey, Name, Type, PublisherSubjectKey string
	BundleRootURI                             common.CanonURI
	VisibleTo                                 []string
}
type UpdateBlockRequest struct {
	SiteID                          int64
	BlockKey                        string
	ExpectedRevision                int64
	Name, Type, PublisherSubjectKey string
	BundleRootURI                   common.CanonURI
}
type BlockService struct{ store *SQLiteStore }

func NewBlockService(s *SQLiteStore) (*BlockService, error) {
	if s == nil || s.db == nil {
		return nil, ErrInvalidRecord
	}
	return &BlockService{store: s}, nil
}
func validBlockKey(v string) bool {
	return v == strings.TrimSpace(v) && v != "tree.json" && validPageKey(v)
}
func validBlockType(v string) bool { return v == "ui-component" || v == "content" }
func validateBlock(in NewBlock) error {
	if in.SiteID <= 0 || !validBlockKey(in.BlockKey) || strings.TrimSpace(in.Name) == "" || !validBlockType(in.Type) || strings.TrimSpace(in.PublisherSubjectKey) == "" || !common.IsCanonURI(in.BundleRootURI) {
		if !validBlockType(in.Type) {
			return ErrInvalidBlockType
		}
		return ErrInvalidRecord
	}
	_, e := normalizeAudiences(in.VisibleTo)
	return e
}
func (s *BlockService) CreateBlock(ctx context.Context, r CreateBlockRequest) (*Block, error) {
	r.BlockKey = strings.TrimSpace(r.BlockKey)
	r.Name = strings.TrimSpace(r.Name)
	r.Type = strings.TrimSpace(r.Type)
	r.PublisherSubjectKey = strings.TrimSpace(r.PublisherSubjectKey)
	in := NewBlock{SiteID: r.SiteID, BlockKey: r.BlockKey, Name: r.Name, Type: r.Type, PublisherSubjectKey: r.PublisherSubjectKey, BundleRootURI: r.BundleRootURI, VisibleTo: r.VisibleTo}
	if e := validateBlock(in); e != nil {
		return nil, e
	}
	return s.store.CreateBlock(ctx, in)
}
func (s *BlockService) UpdateBlock(ctx context.Context, r UpdateBlockRequest) (*Block, error) {
	if r.ExpectedRevision <= 0 {
		return nil, ErrInvalidRecord
	}
	return s.store.UpdateBlock(ctx, r.SiteID, r.BlockKey, r.Name, r.Type, r.PublisherSubjectKey, r.BundleRootURI, r.ExpectedRevision)
}
func (s *BlockService) DeleteBlock(ctx context.Context, siteID int64, key string, rev int64) error {
	return s.store.DeleteBlock(ctx, siteID, key, rev)
}
func ParseBlockTree(data []byte) (BlockTreeDocument, error) {
	var d BlockTreeDocument
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if e := dec.Decode(&d); e != nil || d.Revision < 1 {
		return d, ErrInvalidBlockTree
	}
	if e := dec.Decode(&struct{}{}); e != io.EOF {
		return d, ErrInvalidBlockTree
	}
	seenFolders := map[string]bool{}
	seenBlocks := map[string]bool{}
	var walk func([]BlockFolder) error
	walk = func(fs []BlockFolder) error {
		for _, f := range fs {
			if !validBlockKey(f.Key) || strings.TrimSpace(f.Name) == "" || seenFolders[f.Key] {
				return ErrInvalidBlockTree
			}
			seenFolders[f.Key] = true
			for _, b := range f.Blocks {
				if !validBlockKey(b) || seenBlocks[b] {
					return ErrInvalidBlockTree
				}
				seenBlocks[b] = true
			}
			if e := walk(f.Folders); e != nil {
				return e
			}
		}
		return nil
	}
	if e := walk(d.Folders); e != nil {
		return d, e
	}
	return d, nil
}
func (s *BlockService) ReplaceTree(ctx context.Context, siteID int64, data []byte) (*BlockTree, error) {
	d, e := ParseBlockTree(data)
	if e != nil {
		return nil, e
	}
	var check func([]BlockFolder) error
	check = func(fs []BlockFolder) error {
		for _, f := range fs {
			for _, k := range f.Blocks {
				if _, e := s.store.BlockByKey(ctx, siteID, k); e != nil {
					return e
				}
			}
			if e := check(f.Folders); e != nil {
				return e
			}
		}
		return nil
	}
	if e = check(d.Folders); e != nil {
		return nil, e
	}
	// The stored document carries the revision it will have after the CAS.
	expectedRevision := d.Revision
	d.Revision++
	normalized, _ := json.Marshal(d)
	return s.store.ReplaceBlockTree(ctx, siteID, expectedRevision, normalized)
}
func (s *SQLiteStore) CreateBlock(ctx context.Context, in NewBlock) (*Block, error) {
	in.BlockKey = strings.TrimSpace(in.BlockKey)
	in.Name = strings.TrimSpace(in.Name)
	in.Type = strings.TrimSpace(in.Type)
	in.PublisherSubjectKey = strings.TrimSpace(in.PublisherSubjectKey)
	if e := validateBlock(in); e != nil {
		return nil, e
	}
	e := s.withTx(ctx, func(tx *sql.Tx) error {
		r, e := tx.ExecContext(ctx, `INSERT INTO html_blocks(site_id,block_key,name,type,publisher_subject_key,bundle_root_uri) VALUES(?,?,?,?,?,?)`, in.SiteID, strings.TrimSpace(in.BlockKey), strings.TrimSpace(in.Name), in.Type, strings.TrimSpace(in.PublisherSubjectKey), string(in.BundleRootURI))
		if e != nil {
			return e
		}
		if _, e = r.LastInsertId(); e != nil {
			return e
		}
		a, e := normalizeAudiences(in.VisibleTo)
		if e != nil {
			return e
		}
		if e = replaceNodeVisibilityTx(ctx, tx, in.SiteID, NodeKindBlock, strings.TrimSpace(in.BlockKey), a); e != nil {
			return e
		}
		_, e = bumpVisibilityRevisionTx(ctx, tx, in.SiteID)
		return e
	})
	if e != nil {
		return nil, classifyStoreError(e)
	}
	return s.BlockByKey(ctx, in.SiteID, in.BlockKey)
}

const blockSelect = `SELECT id,site_id,block_key,name,type,publisher_subject_key,bundle_root_uri,revision,created_at,updated_at FROM html_blocks`

func scanBlock(row rowScanner) (*Block, error) {
	var b Block
	var u string
	e := row.Scan(&b.ID, &b.SiteID, &b.BlockKey, &b.Name, &b.Type, &b.PublisherSubjectKey, &u, &b.Revision, &b.CreatedAt, &b.UpdatedAt)
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrBlockNotFound
	}
	if e != nil {
		return nil, e
	}
	b.BundleRootURI = common.CanonURI(u)
	return &b, nil
}
func (s *SQLiteStore) BlockByKey(c context.Context, sid int64, k string) (*Block, error) {
	return scanBlock(s.db.QueryRowContext(c, blockSelect+` WHERE site_id=? AND block_key=?`, sid, k))
}
func (s *SQLiteStore) ListBlocks(c context.Context, sid int64) ([]Block, error) {
	rows, e := s.db.QueryContext(c, blockSelect+` WHERE site_id=? ORDER BY block_key`, sid)
	if e != nil {
		return nil, e
	}
	defer rows.Close()
	out := []Block{}
	for rows.Next() {
		b, e := scanBlock(rows)
		if e != nil {
			return nil, e
		}
		out = append(out, *b)
	}
	return out, rows.Err()
}
func (s *SQLiteStore) UpdateBlock(c context.Context, sid int64, k, n, t, p string, u common.CanonURI, rev int64) (*Block, error) {
	if sid <= 0 || rev < 1 || !validBlockKey(k) || strings.TrimSpace(n) == "" || !validBlockType(t) || strings.TrimSpace(p) == "" || !common.IsCanonURI(u) {
		if !validBlockType(t) {
			return nil, ErrInvalidBlockType
		}
		return nil, ErrInvalidRecord
	}
	r, e := s.db.ExecContext(c, `UPDATE html_blocks SET name=?,type=?,publisher_subject_key=?,bundle_root_uri=?,revision=revision+1,updated_at=CURRENT_TIMESTAMP WHERE site_id=? AND block_key=? AND revision=?`, strings.TrimSpace(n), t, strings.TrimSpace(p), string(u), sid, k, rev)
	if e != nil {
		return nil, e
	}
	z, _ := r.RowsAffected()
	if z == 0 {
		b, x := s.BlockByKey(c, sid, k)
		if x != nil {
			return nil, x
		}
		return nil, &RevisionConflict{Kind: ErrBlockRevisionConflict, Current: b.Revision}
	}
	return s.BlockByKey(c, sid, k)
}
func (s *SQLiteStore) DeleteBlock(c context.Context, sid int64, k string, rev int64) error {
	return s.withTx(c, func(tx *sql.Tx) error {
		block, err := scanBlock(tx.QueryRowContext(c, blockSelect+` WHERE site_id=? AND block_key=?`, sid, k))
		if err != nil {
			return err
		}
		if block.Revision != rev {
			return &RevisionConflict{Kind: ErrBlockRevisionConflict, Current: block.Revision}
		}

		var tree BlockTree
		if err := tx.QueryRowContext(c, `SELECT site_id,revision,document_json,updated_at FROM html_block_trees WHERE site_id=?`, sid).Scan(&tree.SiteID, &tree.Revision, &tree.DocumentJSON, &tree.UpdatedAt); err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				return ErrSiteNotFound
			}
			return err
		}
		document, err := ParseBlockTree(tree.DocumentJSON)
		if err != nil {
			return err
		}
		if removeBlockKey(document.Folders, k) {
			document.Revision = tree.Revision + 1
			data, err := json.Marshal(document)
			if err != nil {
				return err
			}
			if _, err := tx.ExecContext(c, `UPDATE html_block_trees SET revision=revision+1,document_json=?,updated_at=CURRENT_TIMESTAMP WHERE site_id=? AND revision=?`, data, sid, tree.Revision); err != nil {
				return err
			}
		}
		_, err = tx.ExecContext(c, `DELETE FROM html_blocks WHERE site_id=? AND block_key=? AND revision=?`, sid, k, rev)
		return err
	})
}

func removeBlockKey(folders []BlockFolder, key string) bool {
	changed := false
	for i := range folders {
		folder := &folders[i]
		kept := folder.Blocks[:0]
		for _, candidate := range folder.Blocks {
			if candidate == key {
				changed = true
				continue
			}
			kept = append(kept, candidate)
		}
		folder.Blocks = kept
		if removeBlockKey(folder.Folders, key) {
			changed = true
		}
	}
	return changed
}
func (s *SQLiteStore) ReadBlockTree(c context.Context, sid int64) (*BlockTree, error) {
	var x BlockTree
	e := s.db.QueryRowContext(c, `SELECT site_id,revision,document_json,updated_at FROM html_block_trees WHERE site_id=?`, sid).Scan(&x.SiteID, &x.Revision, &x.DocumentJSON, &x.UpdatedAt)
	if errors.Is(e, sql.ErrNoRows) {
		return nil, ErrSiteNotFound
	}
	return &x, e
}
func (s *SQLiteStore) ReplaceBlockTree(c context.Context, sid, rev int64, d []byte) (*BlockTree, error) {
	document, err := ParseBlockTree(d)
	if err != nil {
		return nil, err
	}
	if document.Revision != rev+1 {
		return nil, ErrInvalidBlockTree
	}
	var result *BlockTree
	err = s.withTx(c, func(tx *sql.Tx) error {
		var check func([]BlockFolder) error
		check = func(folders []BlockFolder) error {
			for _, folder := range folders {
				for _, key := range folder.Blocks {
					if _, err := scanBlock(tx.QueryRowContext(c, blockSelect+` WHERE site_id=? AND block_key=?`, sid, key)); err != nil {
						return err
					}
				}
				if err := check(folder.Folders); err != nil {
					return err
				}
			}
			return nil
		}
		if err := check(document.Folders); err != nil {
			return err
		}
		r, err := tx.ExecContext(c, `UPDATE html_block_trees SET revision=revision+1,document_json=?,updated_at=CURRENT_TIMESTAMP WHERE site_id=? AND revision=?`, d, sid, rev)
		if err != nil {
			return err
		}
		if changed, _ := r.RowsAffected(); changed == 0 {
			var current int64
			if err := tx.QueryRowContext(c, `SELECT revision FROM html_block_trees WHERE site_id=?`, sid).Scan(&current); err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					return ErrSiteNotFound
				}
				return err
			}
			return &RevisionConflict{Kind: ErrBlockTreeRevisionConflict, Current: current}
		}
		result = &BlockTree{SiteID: sid}
		return tx.QueryRowContext(c, `SELECT revision,document_json,updated_at FROM html_block_trees WHERE site_id=?`, sid).Scan(&result.Revision, &result.DocumentJSON, &result.UpdatedAt)
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}
