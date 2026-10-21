package vfs

import (
	"path"
	"strconv"
	"strings"
)

type IDKind string
type RawID string

const (
	IDLocal IDKind = "local"
	IDMount IDKind = "mount"
)

type CanonicalID struct {
	Kind IDKind
	Raw  RawID

	LocalID string

	MountID int64
	MountPath string
}

func ParseID(raw RawID) (CanonicalID, error) {
	canonicalId := CanonicalID{}
	parts := strings.SplitN(strings.Trim(string(raw), " "), ":", 3)
	switch parts[0] {
	case string(IDMount):
		mountId, err := strconv.ParseInt(parts[1], 10, 64)
		if err != nil {
			return CanonicalID{}, err
		}
		canonicalId.MountID = mountId
		if len(parts) > 2 {
			canonicalId.MountPath = parts[2]
		} else {
			canonicalId.MountPath = ""
		}
	default:
		canonicalId.Kind = IDLocal
		canonicalId.Raw = raw
		canonicalId.LocalID = string(raw) // because local IDs are in raw js like "1", "14" etc.
	}
	return canonicalId, nil
}

func FormatMountID(mountID int64, subPath string) RawID {
	return RawID("mount:" + strconv.FormatInt(mountID, 10) + ":" + subPath)
}

func PathInside(base, target string) bool {
	base = path.Clean("/" + base)
	target = path.Clean("/" + target)

	return target == base || strings.HasPrefix(target, base+"/")
}