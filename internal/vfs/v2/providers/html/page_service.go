package html

import (
	"github.com/akyaiy/veido/internal/common"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"
)

var (
	ErrPageRevisionConflict = errors.New("page revision conflict")
	ErrTreeRevisionConflict = errors.New("tree revision conflict")
	ErrCycleDetected        = errors.New("page tree cycle detected")
	ErrResourceInUse        = errors.New("html resource is in use")
	ErrInvalidDeleteMode    = errors.New("invalid page delete mode")
	ErrInvalidPosition      = errors.New("invalid page position anchor")
	ErrParentNotFound       = errors.New("page parent not found")
)

const (
	DeleteReject          = "reject"
	DeleteCascade         = "cascade"
	DeletePromoteChildren = "promote_children"
)

type RevisionConflict struct {
	Kind    error
	Current int64
}

func (e *RevisionConflict) Error() string {
	if e == nil {
		return "<nil>"
	}
	return fmt.Sprintf("%v: current revision is %d", e.Kind, e.Current)
}

func (e *RevisionConflict) Unwrap() error {
	if e == nil {
		return nil
	}
	return e.Kind
}

func (e *RevisionConflict) PublicCode() string {
	if e != nil && errors.Is(e.Kind, ErrSiteRevisionConflict) {
		return "site_revision_conflict"
	}
	if e != nil && errors.Is(e.Kind, ErrTreeRevisionConflict) {
		return "tree_revision_conflict"
	}
	if e != nil && errors.Is(e.Kind, ErrVisibilityConflict) {
		return "visibility_revision_conflict"
	}
	if e != nil && errors.Is(e.Kind, ErrLayoutRevisionConflict) {
		return "layout_revision_conflict"
	}
	if e != nil && errors.Is(e.Kind, ErrBlockTreeRevisionConflict) {
		return "block_tree_revision_conflict"
	}
	if e != nil && errors.Is(e.Kind, ErrBlockRevisionConflict) {
		return "block_revision_conflict"
	}
	return "page_revision_conflict"
}

func (e *RevisionConflict) PublicDetails() map[string]any {
	if e == nil {
		return nil
	}
	return map[string]any{"current_revision": e.Current}
}

type PositionAnchor struct {
	BeforeID *int64
	AfterID  *int64
	First    bool
	Last     bool
}

type CreatePageRequest struct {
	SiteID               int64
	ExpectedTreeRevision int64
	ParentID             *int64
	Anchor               PositionAnchor
	PageKey              string
	Slug                 string
	Title                string
	Note                 string
	Description          string
	Status               string
	PublisherSubjectKey  string
	BundleRootURI        common.CanonURI
	Types                []string
	SearchTags           []string
	VisibleTo            []string
}

type UpdatePageRequest struct {
	SiteID               int64
	PageID               int64
	ExpectedPageRevision int64
	Slug                 *string
	Title                *string
	Note                 *string
	Description          *string
	Status               *string
}

type MovePageRequest struct {
	SiteID               int64
	PageID               int64
	ParentID             *int64
	Anchor               PositionAnchor
	ExpectedTreeRevision int64
}

type DeletePageRequest struct {
	SiteID               int64
	PageID               int64
	ExpectedPageRevision int64
	ExpectedTreeRevision int64
	Mode                 string
}

type SetPageValuesRequest struct {
	SiteID               int64
	PageID               int64
	ExpectedPageRevision int64
	Values               []string
}

type PageMutationResult struct {
	PageRevision  int64
	ModelRevision int64
}

type TreeMutationResult struct {
	PageID             int64
	PageRevision       int64
	TreeRevision       int64
	ModelRevision      int64
	VisibilityRevision int64
}

type PageService struct {
	store *SQLiteStore
}

func NewPageService(store *SQLiteStore) (*PageService, error) {
	if store == nil || store.db == nil {
		return nil, ErrInvalidRecord
	}
	return &PageService{store: store}, nil
}

func (s *PageService) CreatePage(ctx context.Context, request CreatePageRequest) (*TreeMutationResult, error) {
	if request.SiteID <= 0 || request.ExpectedTreeRevision <= 0 {
		return nil, ErrInvalidRecord
	}
	if err := validateAnchor(request.Anchor); err != nil {
		return nil, err
	}
	newPage := NewPage{
		SiteID:              request.SiteID,
		ParentID:            request.ParentID,
		PageKey:             request.PageKey,
		Slug:                request.Slug,
		Title:               request.Title,
		Note:                request.Note,
		Description:         request.Description,
		Status:              request.Status,
		PublisherSubjectKey: request.PublisherSubjectKey,
		BundleRootURI:       request.BundleRootURI,
		Types:               request.Types,
		SearchTags:          request.SearchTags,
		VisibleTo:           request.VisibleTo,
	}
	if err := validateNewPage(newPage); err != nil {
		return nil, err
	}

	var result TreeMutationResult
	err := s.store.withTx(ctx, func(tx *sql.Tx) error {
		treeRevision, modelRevision, err := claimTreeRevisionTx(ctx, tx, request.SiteID, request.ExpectedTreeRevision)
		if err != nil {
			return err
		}
		if err := requireParentTx(ctx, tx, request.SiteID, request.ParentID); err != nil {
			return err
		}
		siblings, err := siblingIDsTx(ctx, tx, request.SiteID, request.ParentID)
		if err != nil {
			return err
		}
		index, err := anchorIndex(request.Anchor, siblings)
		if err != nil {
			return err
		}
		if err := parkPagesTx(ctx, tx, request.SiteID, siblings); err != nil {
			return err
		}
		pageID, err := insertPageTx(ctx, tx, newPage, index)
		if err != nil {
			return err
		}
		order := insertID(siblings, index, pageID)
		if err := rewriteOrderTx(ctx, tx, request.SiteID, request.ParentID, order); err != nil {
			return err
		}
		audiences, err := normalizeAudiences(request.VisibleTo)
		if err != nil {
			return err
		}
		if err := replaceNodeVisibilityTx(ctx, tx, request.SiteID, NodeKindPage, strings.TrimSpace(request.PageKey), audiences); err != nil {
			return err
		}
		visibilityRevision, err := bumpVisibilityRevisionTx(ctx, tx, request.SiteID)
		if err != nil {
			return err
		}
		result = TreeMutationResult{
			PageID:             pageID,
			PageRevision:       1,
			TreeRevision:       treeRevision,
			ModelRevision:      modelRevision,
			VisibilityRevision: visibilityRevision,
		}
		return nil
	})
	if err != nil {
		return nil, classifyPageServiceError(err)
	}
	return &result, nil
}

func (s *PageService) UpdatePage(ctx context.Context, request UpdatePageRequest) (*PageMutationResult, error) {
	if request.SiteID <= 0 || request.PageID <= 0 || request.ExpectedPageRevision <= 0 || !hasPagePatch(request) {
		return nil, ErrInvalidRecord
	}
	if request.Slug != nil && strings.TrimSpace(*request.Slug) == "" {
		return nil, ErrInvalidRecord
	}

	var result PageMutationResult
	err := s.store.withTx(ctx, func(tx *sql.Tx) error {
		page, err := pageByIDTx(ctx, tx, request.SiteID, request.PageID)
		if err != nil {
			return err
		}
		if page.Revision != request.ExpectedPageRevision {
			return pageConflict(page.Revision)
		}
		slug, title, note, description, status := page.Slug, page.Title, page.Note, page.Description, page.Status
		if request.Slug != nil {
			slug = strings.TrimSpace(*request.Slug)
		}
		if request.Title != nil {
			title = *request.Title
		}
		if request.Note != nil {
			note = *request.Note
		}
		if request.Description != nil {
			description = *request.Description
		}
		if request.Status != nil {
			status = *request.Status
		}
		updated, err := tx.ExecContext(ctx, `
			UPDATE html_pages
			SET slug = ?, title = ?, note = ?, description = ?, status = ?,
				revision = revision + 1, updated_at = CURRENT_TIMESTAMP
			WHERE site_id = ? AND id = ? AND revision = ?`,
			slug, title, note, description, status,
			request.SiteID, request.PageID, request.ExpectedPageRevision,
		)
		if err != nil {
			return err
		}
		if err := requireOneRow(updated); err != nil {
			return currentPageConflictTx(ctx, tx, request.SiteID, request.PageID)
		}
		modelChanged := request.Title != nil || request.Description != nil
		modelRevision, err := currentModelRevisionTx(ctx, tx, request.SiteID)
		if err != nil {
			return err
		}
		if modelChanged {
			modelRevision, err = incrementModelRevisionTx(ctx, tx, request.SiteID)
			if err != nil {
				return err
			}
		}
		result = PageMutationResult{
			PageRevision:  request.ExpectedPageRevision + 1,
			ModelRevision: modelRevision,
		}
		return nil
	})
	if err != nil {
		return nil, classifyPageServiceError(err)
	}
	return &result, nil
}

func (s *PageService) MovePage(ctx context.Context, request MovePageRequest) (*TreeMutationResult, error) {
	if request.SiteID <= 0 || request.PageID <= 0 || request.ExpectedTreeRevision <= 0 {
		return nil, ErrInvalidRecord
	}
	if err := validateAnchor(request.Anchor); err != nil {
		return nil, err
	}

	var result TreeMutationResult
	err := s.store.withTx(ctx, func(tx *sql.Tx) error {
		treeRevision, modelRevision, err := claimTreeRevisionTx(ctx, tx, request.SiteID, request.ExpectedTreeRevision)
		if err != nil {
			return err
		}
		page, err := pageByIDTx(ctx, tx, request.SiteID, request.PageID)
		if err != nil {
			return err
		}
		if err := requireParentTx(ctx, tx, request.SiteID, request.ParentID); err != nil {
			return err
		}
		if request.ParentID != nil {
			if *request.ParentID == request.PageID {
				return ErrCycleDetected
			}
			cycle, err := descendantContainsTx(ctx, tx, request.SiteID, request.PageID, *request.ParentID)
			if err != nil {
				return err
			}
			if cycle {
				return ErrCycleDetected
			}
		}

		oldSiblings, err := siblingIDsTx(ctx, tx, request.SiteID, page.ParentID)
		if err != nil {
			return err
		}
		oldWithoutPage := removeID(oldSiblings, request.PageID)
		sameParent := equalOptionalID(page.ParentID, request.ParentID)
		if sameParent {
			index, err := anchorIndex(request.Anchor, oldWithoutPage)
			if err != nil {
				return err
			}
			order := insertID(oldWithoutPage, index, request.PageID)
			if err := parkPagesTx(ctx, tx, request.SiteID, oldSiblings); err != nil {
				return err
			}
			if err := rewriteOrderTx(ctx, tx, request.SiteID, request.ParentID, order); err != nil {
				return err
			}
		} else {
			newSiblings, err := siblingIDsTx(ctx, tx, request.SiteID, request.ParentID)
			if err != nil {
				return err
			}
			index, err := anchorIndex(request.Anchor, newSiblings)
			if err != nil {
				return err
			}
			if err := parkPagesTx(ctx, tx, request.SiteID, oldSiblings); err != nil {
				return err
			}
			if err := parkPagesTx(ctx, tx, request.SiteID, newSiblings); err != nil {
				return err
			}
			temporary, err := nextPositionTx(ctx, tx, request.SiteID, request.ParentID)
			if err != nil {
				return err
			}
			if _, err := tx.ExecContext(ctx, `UPDATE html_pages
				SET parent_id = ?, position = ?, updated_at = CURRENT_TIMESTAMP
				WHERE site_id = ? AND id = ?`, request.ParentID, temporary, request.SiteID, request.PageID); err != nil {
				return err
			}
			if err := rewriteOrderTx(ctx, tx, request.SiteID, page.ParentID, oldWithoutPage); err != nil {
				return err
			}
			order := insertID(newSiblings, index, request.PageID)
			if err := rewriteOrderTx(ctx, tx, request.SiteID, request.ParentID, order); err != nil {
				return err
			}
		}
		result = TreeMutationResult{
			PageID:        request.PageID,
			PageRevision:  page.Revision,
			TreeRevision:  treeRevision,
			ModelRevision: modelRevision,
		}
		return nil
	})
	if err != nil {
		return nil, classifyPageServiceError(err)
	}
	return &result, nil
}

func (s *PageService) DeletePage(ctx context.Context, request DeletePageRequest) (*TreeMutationResult, error) {
	if request.SiteID <= 0 || request.PageID <= 0 || request.ExpectedPageRevision <= 0 || request.ExpectedTreeRevision <= 0 {
		return nil, ErrInvalidRecord
	}
	if request.Mode != DeleteReject && request.Mode != DeleteCascade && request.Mode != DeletePromoteChildren {
		return nil, ErrInvalidDeleteMode
	}

	var result TreeMutationResult
	err := s.store.withTx(ctx, func(tx *sql.Tx) error {
		treeRevision, modelRevision, err := claimTreeRevisionTx(ctx, tx, request.SiteID, request.ExpectedTreeRevision)
		if err != nil {
			return err
		}
		page, err := pageByIDTx(ctx, tx, request.SiteID, request.PageID)
		if err != nil {
			return err
		}
		if page.Revision != request.ExpectedPageRevision {
			return pageConflict(page.Revision)
		}
		children, err := siblingIDsTx(ctx, tx, request.SiteID, &request.PageID)
		if err != nil {
			return err
		}
		if request.Mode == DeleteReject && len(children) > 0 {
			return ErrResourceInUse
		}
		parentSiblings, err := siblingIDsTx(ctx, tx, request.SiteID, page.ParentID)
		if err != nil {
			return err
		}
		remaining := removeID(parentSiblings, request.PageID)

		switch request.Mode {
		case DeleteReject:
			if err := deletePageIDsTx(ctx, tx, request.SiteID, []int64{request.PageID}); err != nil {
				return err
			}
		case DeleteCascade:
			ids, err := subtreeIDsDeepestFirstTx(ctx, tx, request.SiteID, request.PageID)
			if err != nil {
				return err
			}
			if err := deletePageIDsTx(ctx, tx, request.SiteID, ids); err != nil {
				return err
			}
		case DeletePromoteChildren:
			if len(children) > 0 {
				if err := parkPagesTx(ctx, tx, request.SiteID, parentSiblings); err != nil {
					return err
				}
				if err := parkPagesTx(ctx, tx, request.SiteID, children); err != nil {
					return err
				}
				temporary, err := nextPositionTx(ctx, tx, request.SiteID, page.ParentID)
				if err != nil {
					return err
				}
				for i, childID := range children {
					if _, err := tx.ExecContext(ctx, `UPDATE html_pages
						SET parent_id = ?, position = ?, updated_at = CURRENT_TIMESTAMP
						WHERE site_id = ? AND id = ?`, page.ParentID, temporary+i, request.SiteID, childID); err != nil {
						return err
					}
				}
			}
			if err := deletePageIDsTx(ctx, tx, request.SiteID, []int64{request.PageID}); err != nil {
				return err
			}
			insertion := indexOf(parentSiblings, request.PageID)
			remaining = insertIDs(remaining, insertion, children)
		}
		if err := parkPagesTx(ctx, tx, request.SiteID, remaining); err != nil {
			return err
		}
		if err := rewriteOrderTx(ctx, tx, request.SiteID, page.ParentID, remaining); err != nil {
			return err
		}
		visibilityRevision, err := bumpVisibilityRevisionTx(ctx, tx, request.SiteID)
		if err != nil {
			return err
		}
		result = TreeMutationResult{
			PageID:             request.PageID,
			TreeRevision:       treeRevision,
			ModelRevision:      modelRevision,
			VisibilityRevision: visibilityRevision,
		}
		return nil
	})
	if err != nil {
		return nil, classifyPageServiceError(err)
	}
	return &result, nil
}

func (s *PageService) SetTypes(ctx context.Context, request SetPageValuesRequest) (*PageMutationResult, error) {
	return s.setPageValues(ctx, request, "html_page_types", "type", true)
}

func (s *PageService) SetSearchTags(ctx context.Context, request SetPageValuesRequest) (*PageMutationResult, error) {
	return s.setPageValues(ctx, request, "html_page_search_tags", "tag", false)
}

func (s *PageService) setPageValues(ctx context.Context, request SetPageValuesRequest, table, column string, lower bool) (*PageMutationResult, error) {
	if request.SiteID <= 0 || request.PageID <= 0 || request.ExpectedPageRevision <= 0 {
		return nil, ErrInvalidRecord
	}
	var result PageMutationResult
	err := s.store.withTx(ctx, func(tx *sql.Tx) error {
		updated, err := tx.ExecContext(ctx, `UPDATE html_pages
			SET revision = revision + 1, updated_at = CURRENT_TIMESTAMP
			WHERE site_id = ? AND id = ? AND revision = ?`,
			request.SiteID, request.PageID, request.ExpectedPageRevision)
		if err != nil {
			return err
		}
		if err := requireOneRow(updated); err != nil {
			return currentPageConflictTx(ctx, tx, request.SiteID, request.PageID)
		}
		if err := replaceStrings(ctx, tx, table, column, request.PageID, normalizeSet(request.Values, lower)); err != nil {
			return err
		}
		modelRevision, err := currentModelRevisionTx(ctx, tx, request.SiteID)
		if err != nil {
			return err
		}
		result = PageMutationResult{
			PageRevision:  request.ExpectedPageRevision + 1,
			ModelRevision: modelRevision,
		}
		return nil
	})
	if err != nil {
		return nil, classifyPageServiceError(err)
	}
	return &result, nil
}

func claimTreeRevisionTx(ctx context.Context, tx *sql.Tx, siteID, expected int64) (int64, int64, error) {
	updated, err := tx.ExecContext(ctx, `UPDATE html_sites
		SET tree_revision = tree_revision + 1,
			model_revision = model_revision + 1,
			updated_at = CURRENT_TIMESTAMP
		WHERE id = ? AND tree_revision = ?`, siteID, expected)
	if err != nil {
		return 0, 0, err
	}
	if err := requireOneRow(updated); err != nil {
		var current int64
		queryErr := tx.QueryRowContext(ctx, `SELECT tree_revision FROM html_sites WHERE id = ?`, siteID).Scan(&current)
		if errors.Is(queryErr, sql.ErrNoRows) {
			return 0, 0, ErrSiteNotFound
		}
		if queryErr != nil {
			return 0, 0, queryErr
		}
		return 0, 0, &RevisionConflict{Kind: ErrTreeRevisionConflict, Current: current}
	}
	var tree, model int64
	if err := tx.QueryRowContext(ctx, `SELECT tree_revision, model_revision FROM html_sites WHERE id = ?`, siteID).Scan(&tree, &model); err != nil {
		return 0, 0, err
	}
	return tree, model, nil
}

func incrementModelRevisionTx(ctx context.Context, tx *sql.Tx, siteID int64) (int64, error) {
	updated, err := tx.ExecContext(ctx, `UPDATE html_sites
		SET model_revision = model_revision + 1, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?`, siteID)
	if err != nil {
		return 0, err
	}
	if err := requireOneRow(updated); err != nil {
		return 0, ErrSiteNotFound
	}
	return currentModelRevisionTx(ctx, tx, siteID)
}

func currentModelRevisionTx(ctx context.Context, tx *sql.Tx, siteID int64) (int64, error) {
	var revision int64
	err := tx.QueryRowContext(ctx, `SELECT model_revision FROM html_sites WHERE id = ?`, siteID).Scan(&revision)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, ErrSiteNotFound
	}
	return revision, err
}

func pageByIDTx(ctx context.Context, tx *sql.Tx, siteID, pageID int64) (*Page, error) {
	return scanPage(tx.QueryRowContext(ctx, pageSelect+` WHERE site_id = ? AND id = ?`, siteID, pageID))
}

func requireParentTx(ctx context.Context, tx *sql.Tx, siteID int64, parentID *int64) error {
	if parentID == nil {
		return nil
	}
	if _, err := pageByIDTx(ctx, tx, siteID, *parentID); err != nil {
		if errors.Is(err, ErrPageNotFound) {
			return ErrParentNotFound
		}
		return err
	}
	return nil
}

func siblingIDsTx(ctx context.Context, tx *sql.Tx, siteID int64, parentID *int64) ([]int64, error) {
	query := `SELECT id FROM html_pages WHERE site_id = ? AND parent_id IS NULL ORDER BY position, id`
	args := []any{siteID}
	if parentID != nil {
		query = `SELECT id FROM html_pages WHERE site_id = ? AND parent_id = ? ORDER BY position, id`
		args = append(args, *parentID)
	}
	rows, err := tx.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := make([]int64, 0)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func parkPagesTx(ctx context.Context, tx *sql.Tx, siteID int64, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	var maximum int
	if err := tx.QueryRowContext(ctx, `SELECT COALESCE(MAX(position), -1) FROM html_pages WHERE site_id = ?`, siteID).Scan(&maximum); err != nil {
		return err
	}
	base := maximum + len(ids) + 1
	for i, id := range ids {
		if _, err := tx.ExecContext(ctx, `UPDATE html_pages SET position = ? WHERE site_id = ? AND id = ?`, base+i, siteID, id); err != nil {
			return err
		}
	}
	return nil
}

func nextPositionTx(ctx context.Context, tx *sql.Tx, siteID int64, parentID *int64) (int, error) {
	query := `SELECT COALESCE(MAX(position), -1) + 1 FROM html_pages WHERE site_id = ? AND parent_id IS NULL`
	args := []any{siteID}
	if parentID != nil {
		query = `SELECT COALESCE(MAX(position), -1) + 1 FROM html_pages WHERE site_id = ? AND parent_id = ?`
		args = append(args, *parentID)
	}
	var position int
	err := tx.QueryRowContext(ctx, query, args...).Scan(&position)
	return position, err
}

func rewriteOrderTx(ctx context.Context, tx *sql.Tx, siteID int64, parentID *int64, ids []int64) error {
	for position, id := range ids {
		result, err := tx.ExecContext(ctx, `UPDATE html_pages
			SET parent_id = ?, position = ?, updated_at = CURRENT_TIMESTAMP
			WHERE site_id = ? AND id = ?`, parentID, position, siteID, id)
		if err != nil {
			return err
		}
		if err := requireOneRow(result); err != nil {
			return ErrPageNotFound
		}
	}
	return nil
}

func insertPageTx(ctx context.Context, tx *sql.Tx, input NewPage, position int) (int64, error) {
	result, err := tx.ExecContext(ctx, `INSERT INTO html_pages (
		site_id, parent_id, page_key, slug, title, note, description,
		status, position, publisher_subject_key, source_uri, bundle_root_uri
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		input.SiteID,
		input.ParentID,
		strings.TrimSpace(input.PageKey),
		strings.TrimSpace(input.Slug),
		input.Title,
		input.Note,
		input.Description,
		input.Status,
		position,
		strings.TrimSpace(input.PublisherSubjectKey),
		legacyContentURI(input.BundleRootURI),
		string(input.BundleRootURI),
	)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	if err := replaceStrings(ctx, tx, "html_page_types", "type", id, normalizeSet(input.Types, true)); err != nil {
		return 0, err
	}
	if err := replaceStrings(ctx, tx, "html_page_search_tags", "tag", id, normalizeSet(input.SearchTags, false)); err != nil {
		return 0, err
	}
	return id, nil
}

func descendantContainsTx(ctx context.Context, tx *sql.Tx, siteID, rootID, candidateID int64) (bool, error) {
	var found bool
	err := tx.QueryRowContext(ctx, `WITH RECURSIVE subtree(id) AS (
		SELECT id FROM html_pages WHERE site_id = ? AND id = ?
		UNION ALL
		SELECT child.id FROM html_pages child JOIN subtree parent ON child.parent_id = parent.id
		WHERE child.site_id = ?
	) SELECT EXISTS(SELECT 1 FROM subtree WHERE id = ?)`, siteID, rootID, siteID, candidateID).Scan(&found)
	return found, err
}

func subtreeIDsDeepestFirstTx(ctx context.Context, tx *sql.Tx, siteID, rootID int64) ([]int64, error) {
	rows, err := tx.QueryContext(ctx, `WITH RECURSIVE subtree(id, depth) AS (
		SELECT id, 0 FROM html_pages WHERE site_id = ? AND id = ?
		UNION ALL
		SELECT child.id, parent.depth + 1
		FROM html_pages child JOIN subtree parent ON child.parent_id = parent.id
		WHERE child.site_id = ?
	) SELECT id FROM subtree ORDER BY depth DESC, id`, siteID, rootID, siteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := make([]int64, 0)
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func deletePageIDsTx(ctx context.Context, tx *sql.Tx, siteID int64, ids []int64) error {
	for _, id := range ids {
		if _, err := tx.ExecContext(ctx, `DELETE FROM html_page_types WHERE page_id = ?`, id); err != nil {
			return err
		}
		if _, err := tx.ExecContext(ctx, `DELETE FROM html_page_search_tags WHERE page_id = ?`, id); err != nil {
			return err
		}
		result, err := tx.ExecContext(ctx, `DELETE FROM html_pages WHERE site_id = ? AND id = ?`, siteID, id)
		if err != nil {
			return err
		}
		if err := requireOneRow(result); err != nil {
			return ErrPageNotFound
		}
	}
	return nil
}

func currentPageConflictTx(ctx context.Context, tx *sql.Tx, siteID, pageID int64) error {
	var revision int64
	err := tx.QueryRowContext(ctx, `SELECT revision FROM html_pages WHERE site_id = ? AND id = ?`, siteID, pageID).Scan(&revision)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrPageNotFound
	}
	if err != nil {
		return err
	}
	return pageConflict(revision)
}

func pageConflict(current int64) error {
	return &RevisionConflict{Kind: ErrPageRevisionConflict, Current: current}
}

func requireOneRow(result sql.Result) error {
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected != 1 {
		return sql.ErrNoRows
	}
	return nil
}

func validateAnchor(anchor PositionAnchor) error {
	count := 0
	if anchor.BeforeID != nil {
		count++
	}
	if anchor.AfterID != nil {
		count++
	}
	if anchor.First {
		count++
	}
	if anchor.Last {
		count++
	}
	if count != 1 {
		return ErrInvalidPosition
	}
	return nil
}

func anchorIndex(anchor PositionAnchor, siblings []int64) (int, error) {
	switch {
	case anchor.First:
		return 0, nil
	case anchor.Last:
		return len(siblings), nil
	case anchor.BeforeID != nil:
		index := indexOf(siblings, *anchor.BeforeID)
		if index < 0 {
			return 0, ErrInvalidPosition
		}
		return index, nil
	case anchor.AfterID != nil:
		index := indexOf(siblings, *anchor.AfterID)
		if index < 0 {
			return 0, ErrInvalidPosition
		}
		return index + 1, nil
	default:
		return 0, ErrInvalidPosition
	}
}

func hasPagePatch(request UpdatePageRequest) bool {
	return request.Slug != nil || request.Title != nil || request.Note != nil || request.Description != nil || request.Status != nil
}

func equalOptionalID(left, right *int64) bool {
	if left == nil || right == nil {
		return left == nil && right == nil
	}
	return *left == *right
}

func indexOf(ids []int64, id int64) int {
	for index, candidate := range ids {
		if candidate == id {
			return index
		}
	}
	return -1
}

func removeID(ids []int64, id int64) []int64 {
	out := make([]int64, 0, len(ids))
	for _, candidate := range ids {
		if candidate != id {
			out = append(out, candidate)
		}
	}
	return out
}

func insertID(ids []int64, index int, id int64) []int64 {
	return insertIDs(ids, index, []int64{id})
}

func insertIDs(ids []int64, index int, additions []int64) []int64 {
	if index < 0 {
		index = 0
	}
	if index > len(ids) {
		index = len(ids)
	}
	out := make([]int64, 0, len(ids)+len(additions))
	out = append(out, ids[:index]...)
	out = append(out, additions...)
	out = append(out, ids[index:]...)
	return out
}

func classifyPageServiceError(err error) error {
	if err == nil || errors.Is(err, ErrSiteRevisionConflict) || errors.Is(err, ErrPageRevisionConflict) || errors.Is(err, ErrTreeRevisionConflict) || errors.Is(err, ErrVisibilityConflict) || errors.Is(err, ErrLayoutRevisionConflict) ||
		errors.Is(err, ErrCycleDetected) || errors.Is(err, ErrResourceInUse) ||
		errors.Is(err, ErrInvalidDeleteMode) || errors.Is(err, ErrInvalidPosition) ||
		errors.Is(err, ErrParentNotFound) || errors.Is(err, ErrPageNotFound) || errors.Is(err, ErrSiteNotFound) {
		return err
	}
	return classifyStoreError(err)
}
