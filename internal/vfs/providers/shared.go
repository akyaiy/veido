package providers

import (
	"MyServer/internal/acl"
	"MyServer/internal/vfs"
	"context"
	"database/sql"
	"os"
	"path"
	"strings"
	"sync"
)

type SharedFSProvider struct {
	rootID       string
	db           *sql.DB
	userid       int
	bindProvider vfs.FSProvider
	cache        map[string]vfs.Node
	mu           sync.RWMutex
}

func (s *SharedFSProvider) AvaibleToMe(ctx context.Context, id string) ([]os.FileInfo, error) {
	nodes, err := s.availableNodes(ctx)
	if err != nil {
		return nil, err
	}

	result := make([]os.FileInfo, 0, len(nodes))
	for _, node := range nodes {
		result = append(result, vfs.NewFileInfo(node))
	}
	return result, nil
}

func (s *SharedFSProvider) sharedIDs(ctx context.Context) ([]string, error) {
	perms, err := acl.GetUserPermissions(s.db, int64(s.userid), 10000, 0)
	if err != nil {
		return nil, os.ErrInvalid
	}

	var allowedIDs []string
	for _, p := range perms {
		if p.Access == "allow" && strings.HasPrefix(p.Name, "vfs.shared:") {
			allowedIDs = append(allowedIDs, strings.TrimPrefix(p.Name, "vfs.shared:"))
		}
	}
	return allowedIDs, nil
}

func (s *SharedFSProvider) availableNodes(ctx context.Context) ([]vfs.Node, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT resource_id FROM shares WHERE to_id = $1", s.userid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var nodes []vfs.Node
	for rows.Next() {
		var resourceID string
		if err := rows.Scan(&resourceID); err != nil {
			continue
		}
		if resourceID == s.rootID {
			continue
		}

		node, err := s.bindProvider.Stat(ctx, resourceID)
		if err != nil {
			continue
		}

		node = s.withVirtualPath(node, path.Join("/", node.Name))
		nodes = append(nodes, node)
	}
	return nodes, nil
}

func cleanSharedPath(id string) string {
	if id == "" {
		return "/"
	}
	return path.Clean("/" + id)
}

func (s *SharedFSProvider) withVirtualPath(node vfs.Node, virtualPath string) vfs.Node {
	virtualPath = cleanSharedPath(virtualPath)
	node.ID = virtualPath
	if virtualPath == "/" {
		node.ParentID = ""
		node.Name = "/"
		return node
	}

	node.ParentID = path.Dir(virtualPath)
	if node.ParentID == "." {
		node.ParentID = "/"
	}
	node.Name = path.Base(virtualPath)
	return node
}

func (s *SharedFSProvider) resolveSharedID(ctx context.Context, id string) (string, error) {
	id = cleanSharedPath(id)
	if id == "/" {
		return "/", nil
	}
	parts := strings.Split(strings.Trim(id, "/"), "/")
	baseName := parts[0]
	rows, err := s.db.QueryContext(ctx, "SELECT resource_id FROM shares WHERE to_id = $1", s.userid)
	if err != nil {
		return "", err
	}
	defer rows.Close()
	var resourceID string
	var found bool
	for rows.Next() {
		if err := rows.Scan(&resourceID); err != nil {
			return "", err
		}
		if resourceID == s.rootID {
			continue
		}
		stat, err := s.bindProvider.Stat(ctx, resourceID)
		if err != nil {
			continue
		}
		if stat.Name != baseName {
			continue
		}
		found = true
		break
	}
	if err := rows.Err(); err != nil {
		return "", err
	}
	if !found {
		return "", os.ErrNotExist
	}
	if len(parts) == 1 {
		return resourceID, nil
	}
	remaining := strings.Join(parts[1:], "/")
	return s.bindProvider.ResolvePathToID(context.WithValue(ctx, "relative_node_id", resourceID), remaining)
}

func (s *SharedFSProvider) AvaibleFromMe(ctx context.Context) ([]os.FileInfo, error) {
	rows, err := s.db.QueryContext(ctx, "SELECT resource_id FROM shares WHERE from_id = ?", s.userid)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var resourceIDs []string
	for rows.Next() {
		var resourceID string
		if err := rows.Scan(&resourceID); err != nil {
			return nil, err
		}
		resourceIDs = append(resourceIDs, resourceID)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	var nodes []os.FileInfo
	for _, resourceID := range resourceIDs {
		node, err := s.bindProvider.Stat(ctx, resourceID)
		if err != nil {
			return nil, err
		}
		nodes = append(nodes, vfs.NewFileInfo(node))
	}
	return nodes, nil
}

func (s *SharedFSProvider) AccesibleToMe(ctx context.Context) ([]os.FileInfo, error) {
	nodes, err := s.availableNodes(ctx)
	if err != nil {
		return nil, err
	}
	var nodesInfo []os.FileInfo
	for _, node := range nodes {
		nodesInfo = append(nodesInfo, vfs.NewFileInfo(node))
	}
	return nodesInfo, nil
}

// Delete implements [vfs.FSProvider].
func (s *SharedFSProvider) Delete(ctx context.Context, id string) error {
	id = cleanSharedPath(id)
	resolvedID, err := s.resolveSharedID(ctx, id)
	if err != nil {
		return err
	}
	if resolvedID == "/" {
		return os.ErrPermission
	}
	return s.bindProvider.Delete(ctx, resolvedID)
}

// Mkdir implements [vfs.FSProvider].
func (s *SharedFSProvider) Mkdir(ctx context.Context, parentDirID string, name string) (vfs.Node, error) {
	parentDirID = cleanSharedPath(parentDirID)
	resolvedParentID, err := s.resolveSharedID(ctx, parentDirID)
	if err != nil {
		return vfs.Node{}, err
	}
	if resolvedParentID == "/" {
		return vfs.Node{}, os.ErrPermission
	}

	node, err := s.bindProvider.Mkdir(ctx, resolvedParentID, name)
	if err != nil {
		return vfs.Node{}, err
	}
	return s.withVirtualPath(node, path.Join(parentDirID, node.Name)), nil
}

// Move implements [vfs.FSProvider].
func (s *SharedFSProvider) Move(ctx context.Context, id string, newParentID string, newName string) error {
	id = cleanSharedPath(id)
	newParentID = cleanSharedPath(newParentID)

	resolvedID, err := s.resolveSharedID(ctx, id)
	if err != nil {
		return err
	}
	if resolvedID == "/" {
		return os.ErrPermission
	}

	resolvedParentID, err := s.resolveSharedID(ctx, newParentID)
	if err != nil {
		return err
	}
	if resolvedParentID == "/" {
		if path.Dir(id) != "/" {
			return os.ErrPermission
		}
		node, err := s.bindProvider.Stat(ctx, resolvedID)
		if err != nil {
			return err
		}
		resolvedParentID = node.ParentID
	}

	return s.bindProvider.Move(ctx, resolvedID, resolvedParentID, newName)
}

// OpenFile implements [vfs.FSProvider].
func (s *SharedFSProvider) OpenFile(ctx context.Context, fileID string, parentDirID string, name string, flag int) (vfs.File, error) {
	var err error
	if fileID != "" {
		fileID = cleanSharedPath(fileID)
		fileID, err = s.resolveSharedID(ctx, fileID)
		if err != nil {
			return nil, err
		}
		if fileID == "/" {
			return nil, os.ErrInvalid
		}
	} else {
		parentDirID = cleanSharedPath(parentDirID)
		parentDirID, err = s.resolveSharedID(ctx, parentDirID)
		if err != nil {
			return nil, err
		}
		if parentDirID == "/" {
			return nil, os.ErrPermission
		}
	}
	return s.bindProvider.OpenFile(ctx, fileID, parentDirID, name, flag)
}

// ReadDir implements [vfs.FSProvider].
func (s *SharedFSProvider) ReadDir(ctx context.Context, dirID string) ([]vfs.Node, error) {
	dirID = cleanSharedPath(dirID)
	resolvedID, err := s.resolveSharedID(ctx, dirID)
	if err != nil {
		return nil, err
	}
	if resolvedID == "/" {
		return s.availableNodes(ctx)
	}

	nodes, err := s.bindProvider.ReadDir(ctx, resolvedID)
	if err != nil {
		return nil, err
	}
	for i := range nodes {
		nodes[i] = s.withVirtualPath(nodes[i], path.Join(dirID, nodes[i].Name))
	}
	return nodes, nil
}

// ResolvePathToID implements [vfs.FSProvider].
func (s *SharedFSProvider) ResolvePathToID(ctx context.Context, filePath string) (string, error) {
	_, err := s.resolveSharedID(ctx, filePath)
	if err != nil {
		return "", err
	}
	return cleanSharedPath(filePath), nil
}

// Stat implements [vfs.FSProvider].
func (s *SharedFSProvider) Stat(ctx context.Context, id string) (vfs.Node, error) {
	id = cleanSharedPath(id)
	resolvedID, err := s.resolveSharedID(ctx, id)
	if err != nil {
		return vfs.Node{}, err
	}
	if resolvedID == "/" {
		return vfs.Node{
			ID:    "/",
			Name:  "/",
			IsDir: true,
			Size:  0,
		}, nil
	}
	node, err := s.bindProvider.Stat(ctx, resolvedID)
	if err != nil {
		return vfs.Node{}, err
	}
	return s.withVirtualPath(node, id), nil
}

func NewSharedFSProvider(db *sql.DB, userId int, bindProvider vfs.FSProvider, parentID string) (vfs.FSProvider, error) {
	return &SharedFSProvider{db: db, userid: userId, bindProvider: bindProvider, cache: make(map[string]vfs.Node), rootID: parentID}, nil
}
