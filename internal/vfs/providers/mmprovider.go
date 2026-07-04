package providers

import (
	"MyServer/internal/vfs"
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path"
	"strconv"
	"strings"
	"sync"
	"time"
)

type MountManagerFSProviderContract interface {
	vfs.FSProvider

	RegisterDriver(name string, factory DriverFactory)
	Mount(ctx context.Context, localDirID string, driverType string, config string) error
	Unmount(ctx context.Context, localDirID string) error
}

type DriverFactory func(parentID, config string) (vfs.FSProvider, error)

type MountManagerFSProvider struct {
	db           *sql.DB
	localFS      vfs.FSProvider
	factories    map[string]DriverFactory
	activeMounts map[int64]vfs.FSProvider // Кэш: ID маунта -> готовый созданный инстанс
	failedMounts map[int64]time.Time
	mu           sync.RWMutex // Защита карты от гонок при параллельных запросах
}

func NewMountManagerFSProvider(db *sql.DB, localFS vfs.FSProvider) MountManagerFSProviderContract {
	return &MountManagerFSProvider{
		db:           db,
		localFS:      localFS,
		factories:    make(map[string]DriverFactory),
		activeMounts: make(map[int64]vfs.FSProvider),
		failedMounts: make(map[int64]time.Time),
	}
}

func (m *MountManagerFSProvider) RegisterDriver(name string, factory DriverFactory) {
	m.factories[name] = factory
}

func (m *MountManagerFSProvider) parseID(id string) (isMount bool, mountID int64, subPath string) {
	if strings.HasPrefix(id, "mount:") {
		parts := strings.SplitN(id[6:], ":", 2)
		mID, _ := strconv.ParseInt(parts[0], 10, 64)
		sub := "/"
		if len(parts) > 1 && parts[1] != "" {
			sub = parts[1]
		}
		return true, mID, sub
	}
	return false, 0, id
}

func (m *MountManagerFSProvider) getProvider(ctx context.Context, mountID int64) (vfs.FSProvider, error) {
	m.mu.RLock()
	p, exists := m.activeMounts[mountID]
	failTime, isFailed := m.failedMounts[mountID]
	m.mu.RUnlock()
	if exists {
		return p, nil
	}

	if isFailed {
		if time.Now().Before(failTime) {
			return nil, fmt.Errorf("mount %d is temporarily blocked due to previous initialization failure", mountID)
		}
		m.mu.Lock()
		delete(m.failedMounts, mountID)
		m.mu.Unlock()
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if p, exists = m.activeMounts[mountID]; exists {
		return p, nil
	}

	var driverType, config, parentID string
	err := m.db.QueryRowContext(ctx, "SELECT driver_type, config, parent_metadata_id FROM mounts WHERE id = ?", mountID).Scan(&driverType, &config, &parentID)
	if err == sql.ErrNoRows {
		return nil, os.ErrNotExist
	} else if err != nil {
		return nil, err
	}

	factory, exists := m.factories[driverType]
	if !exists {
		return nil, fmt.Errorf("unsupported mount driver type: %s", driverType)
	}

	providerInstance, err := factory(parentID, config)
	if err != nil {
		log.Printf("Mount %d initialization failed: %v", mountID, err)
		m.failedMounts[mountID] = time.Now().Add(1 * time.Minute)
		return nil, err
	}

	m.activeMounts[mountID] = providerInstance
	return providerInstance, nil
}

func (m *MountManagerFSProvider) getMountOnLocalFolder(ctx context.Context, localDirID string) (int64, error) {
	var mountID int64
	var err error
	if localDirID == "0" || localDirID == "" {
		err = m.db.QueryRowContext(ctx, "SELECT id FROM mounts WHERE parent_metadata_id IS NULL").Scan(&mountID)
	} else {
		intID, _ := strconv.ParseInt(localDirID, 10, 64)
		err = m.db.QueryRowContext(ctx, "SELECT id FROM mounts WHERE parent_metadata_id = ?", intID).Scan(&mountID)
	}
	return mountID, err
}

// resolveNode определяет, какому провайдеру принадлежит конкретный ID (файл или папка)
func (m *MountManagerFSProvider) resolveNode(ctx context.Context, id string) (p vfs.FSProvider, internalID string, mountID int64, err error) {
	isMount, mID, subPath := m.parseID(id)
	if isMount {
		p, err = m.getProvider(ctx, mID)
		if err != nil {
			// Если маунт сломан, но мы просим его корень — не падаем!
			// Возвращаем ошибку, но помечаем, что это корень маунта.
			return nil, subPath, mID, err
		}
		return p, subPath, mID, nil
	}
	return m.localFS, id, 0, nil
}

// resolveContainer определяет целевой провайдер для операций ВНУТРИ папки (с учетом Shadowing)
func (m *MountManagerFSProvider) resolveContainer(ctx context.Context, dirID string) (p vfs.FSProvider, internalID string, mountID int64, err error) {
	isMount, mID, subPath := m.parseID(dirID)
	if isMount {
		p, err = m.getProvider(ctx, mID)
		return p, subPath, mID, err
	}

	// Если ID локальный, проверяем, не перекрыта ли папка маунтом
	mID, err = m.getMountOnLocalFolder(ctx, dirID)
	if err == nil {
		p, err := m.getProvider(ctx, mID)
		if err != nil {
			// Маунт есть в БД, но инициализировать не смогли (например, credentials файл не найден)
			// Gracefully fallback на локальную FS вместо полного краша системы
			log.Printf("[resolveContainer] Mount %d is unavailable, falling back to local FS: %v", mID, err)
			return m.localFS, dirID, 0, nil
		}
		return p, "/", mID, nil // Если перекрыта, принудительно целимся в корень маунта
	}

	return m.localFS, dirID, 0, nil
}

func (m *MountManagerFSProvider) ResolvePathToID(ctx context.Context, filePath string) (string, error) {
	filePath = path.Clean("/" + filePath)

	// Красиво и без костылей обрабатываем корень/пустой путь в одном месте
	if filePath == "/" || filePath == "." {
		if homeID, hasHome := ctx.Value("relative_node_id").(string); hasHome && homeID != "" {
			return homeID, nil
		}
		return "0", nil
	}

	var currentLocalID any = nil

	if homeID, hasHome := ctx.Value("relative_node_id").(string); hasHome && homeID != "" && homeID != "0" {
		// ПРОВЕРКА НА МАУНТ: если относительный путь уже внутри маунта (н-р, "mount:5:/docs")
		if strings.HasPrefix(homeID, "mount:") {
			// Разбираем строку вида "mount:ID:internal_path"
			parts := strings.SplitN(homeID, ":", 3)
			if len(parts) == 3 {
				mountIDStr := parts[1]
				mountPath := parts[2]

				// Просто склеиваем внутренний путь маунта и запрашиваемый filePath.
				// path.Join сам позаботится о правильных слэшах и ".."
				resolvedPath := path.Join(mountPath, filePath)
				return fmt.Sprintf("mount:%s:%s", mountIDStr, resolvedPath), nil
			}
			return "", fmt.Errorf("invalid mount string in context: %s", homeID)
		}

		// Если это обычный ID папки из БД цифрового формата
		intHomeID, err := strconv.ParseInt(homeID, 10, 64)
		if err == nil {
			currentLocalID = intHomeID
		}
	}

	// Дальнейший обход дерева в БД (вызывается, только если мы стартуем из локальной структуры)
	parts := strings.Split(strings.Trim(filePath, "/"), "/")

	for i, part := range parts {
		var nextLocalID int64
		var err error
		if currentLocalID == nil {
			err = m.db.QueryRowContext(ctx, "SELECT id FROM metadata WHERE parent_id IS NULL AND name = ?", part).Scan(&nextLocalID)
		} else {
			err = m.db.QueryRowContext(ctx, "SELECT id FROM metadata WHERE parent_id = ? AND name = ?", currentLocalID, part).Scan(&nextLocalID)
		}

		if err == sql.ErrNoRows {
			return "", fmt.Errorf("path not found: %s", part)
		} else if err != nil {
			return "", err
		}

		var mountID int64
		errMount := m.db.QueryRowContext(ctx, "SELECT id FROM mounts WHERE parent_metadata_id = ?", nextLocalID).Scan(&mountID)

		// Если в процессе обхода наткнулись на маунт
		if errMount == nil {
			remPath := "/" + strings.Join(parts[i+1:], "/")
			return fmt.Sprintf("mount:%d:%s", mountID, path.Clean(remPath)), nil
		}

		currentLocalID = nextLocalID
	}

	return strconv.FormatInt(currentLocalID.(int64), 10), nil
}

func (m *MountManagerFSProvider) ReadDir(ctx context.Context, dirID string) ([]vfs.Node, error) {
	p, internalID, mID, err := m.resolveContainer(ctx, dirID)
	if err != nil {
		return nil, err
	}

	nodes, err := p.ReadDir(ctx, internalID)
	if err != nil {
		return nil, err
	}

	// Если данные пришли из внешнего маунта, маскируем ID для клиента
	if mID > 0 {
		for i := range nodes {
			nodes[i].ID = fmt.Sprintf("mount:%d:%s", mID, nodes[i].ID)
			nodes[i].ParentID = dirID
		}
	}
	return nodes, nil
}

func (m *MountManagerFSProvider) OpenFile(ctx context.Context, fileID string, parentDirID, name string, flag int) (vfs.File, error) {
	var targetProvider vfs.FSProvider
	var targetFileID string
	var targetParentID string
	//var activeMountID int64
	var err error

	if fileID != "" {
		targetProvider, targetFileID, _, err = m.resolveNode(ctx, fileID)
		if err != nil {
			return nil, err
		}
		targetParentID = ""
		name = ""
	} else {
		targetProvider, targetParentID, _, err = m.resolveContainer(ctx, parentDirID)
		if err != nil {
			return nil, err
		}
		targetFileID = ""
	}

	targetFile, err := targetProvider.OpenFile(ctx, targetFileID, targetParentID, name, flag)
	if err != nil {
		return nil, err
	}

	return targetFile, nil
}

func (m *MountManagerFSProvider) Mkdir(ctx context.Context, parentDirID, name string) (vfs.Node, error) {
	p, internalID, mID, err := m.resolveContainer(ctx, parentDirID)
	if err != nil {
		return vfs.Node{}, err
	}

	node, err := p.Mkdir(ctx, internalID, name)
	if err != nil {
		return vfs.Node{}, err
	}

	if mID > 0 {
		node.ID = fmt.Sprintf("mount:%d:%s", mID, node.ID)
		node.ParentID = parentDirID
	}
	return node, nil
}

// Deprecated
// func (m *MountManagerFSProvider) SaveFile(ctx context.Context, parentDirID, name string, src io.Reader) (Node, error) {
// 	p, internalID, mID, err := m.resolveContainer(ctx, parentDirID)
// 	if err != nil {
// 		return Node{}, err
// 	}

// 	node, err := p.SaveFile(ctx, internalID, name, src)
// 	if err != nil {
// 		return Node{}, err
// 	}

// 	if mID > 0 {
// 		node.ID = fmt.Sprintf("mount:%d:%s", mID, node.ID)
// 		node.ParentID = parentDirID
// 	}
// 	return node, nil
// }

func (m *MountManagerFSProvider) Delete(ctx context.Context, id string) error {
	p, internalID, _, err := m.resolveNode(ctx, id)
	if err != nil {
		return err
	}
	return p.Delete(ctx, internalID)
}

func (m *MountManagerFSProvider) Stat(ctx context.Context, id string) (vfs.Node, error) {
	p, internalID, mID, err := m.resolveNode(ctx, id)
	if err != nil {
		// Если упал провайдер маунта, но запрашивают корень этого маунта ("/" или "")
		if mID > 0 && (internalID == "/" || internalID == "") {
			log.Printf("[Stat] Mount %d is dead (%v). ", mID, err)
			return vfs.Node{}, nil
		}
		if mID > 0 {
			return vfs.Node{}, os.ErrNotExist
		}
		return vfs.Node{}, err
	}

	ctxWithOriginalID := context.WithValue(ctx, "original_node_id", id)
	node, err := p.Stat(ctxWithOriginalID, internalID)
	if err != nil {
		return vfs.Node{}, err
	}

	if mID > 0 {
		node.ID = id
		node.ParentID = fmt.Sprintf("mount:%d:%s", mID, node.ParentID)
	}
	return node, nil
}

func (m *MountManagerFSProvider) Move(ctx context.Context, id string, newParentID string, newName string) error {
	isMountOld, mountIDOld, subPathOld := m.parseID(id)
	isMountNew, mountIDNew, subPathNew := m.parseID(newParentID)

	if isMountOld != isMountNew || (isMountOld && mountIDOld != mountIDNew) {
		return fmt.Errorf("cross-provider move is not supported yet (requires read+write+delete)")
	}

	if isMountOld {
		p, err := m.getProvider(ctx, mountIDOld)
		if err != nil {
			return err
		}
		return p.Move(ctx, subPathOld, subPathNew, newName)
	}

	return m.localFS.Move(ctx, id, newParentID, newName)
}

func (m *MountManagerFSProvider) Mount(ctx context.Context, localDirID string, driverType string, config string) error {
	if _, exists := m.factories[driverType]; !exists {
		return fmt.Errorf("driver '%s' is not registered in mount manager", driverType)
	}

	node, err := m.localFS.Stat(ctx, localDirID)
	if err != nil {
		return fmt.Errorf("cannot mount: target folder check failed: %w", err)
	}
	if !node.IsDir {
		return fmt.Errorf("cannot mount: target ID %s is a file, you can only mount into directories", localDirID)
	}

	targetFolderID, err := strconv.ParseInt(localDirID, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid local directory ID format: %w", err)
	}

	_, err = m.db.ExecContext(ctx,
		"INSERT INTO mounts (parent_metadata_id, driver_type, config) VALUES (?, ?, ?)",
		targetFolderID, driverType, config,
	)
	if err != nil {
		// Красиво обрабатываем UNIQUE constraint, если к этой папке уже что-то примонтировано
		if strings.Contains(err.Error(), "UNIQUE constraint failed") {
			return fmt.Errorf("cannot mount: folder ID %d already has an active mount", targetFolderID)
		}
		return err
	}

	return nil
}

func (m *MountManagerFSProvider) Unmount(ctx context.Context, localDirID string) error {
	targetFolderID, err := strconv.ParseInt(localDirID, 10, 64)
	if err != nil {
		return fmt.Errorf("invalid local directory ID format: %w", err)
	}

	res, err := m.db.ExecContext(ctx, "DELETE FROM mounts WHERE parent_metadata_id = ?", targetFolderID)
	if err != nil {
		return err
	}

	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("cannot unmount: no active mount found on folder ID %d", targetFolderID)
	}

	return nil
}
