package local

import (
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	"github.com/akyaiy/veido/internal/vfs/v2/virtfs"
	sdk "github.com/akyaiy/veido/pkg/vfs/providersdk"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path"
	"strings"
)

type accountInfoReader func(ctx context.Context) (*AccountInfo, error)
type accountStatsReader func(ctx context.Context) (*AccountStats, error)

func bootstrapControlFS(
	connection vfs.ProviderConnection,
	accounts AccountStore,
	readCreateRequest func(ctx context.Context) (vfs.File, error),
	writeCreateRequest func(ctx context.Context, data []byte) error,
) *virtfs.FS {
	return virtfs.New().
		Route("/", virtfs.Handler{
			Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
				return virtfs.DirNode("/"), nil
			},
			ReadDir: func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
				return []*vfs.Node{}, nil
			},
		}).
		Route("/"+accountDir, virtfs.Handler{
			Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
				return virtfs.DirNode(accountDir), nil
			},
			ReadDir: func(ctx context.Context, req virtfs.Request) ([]*vfs.Node, error) {
				nodes := []*vfs.Node{virtfs.FileNode("README.md", int64(len(bootstrapREADME)))}
				consumed, err := accounts.BootstrapConsumed(ctx, connection)
				if err != nil {
					return nil, err
				}
				if consumed {
					nodes = append(nodes, virtfs.FileNode("info.json", 0))
				} else {
					nodes = append(nodes, virtfs.FileNode("create_request.json", 0))
				}
				return nodes, nil
			},
		}).
		GeneratedFile("/"+accountDir+"/README.md", func(ctx context.Context, req virtfs.Request) ([]byte, error) {
			return []byte(bootstrapREADME), nil
		}).
		Route("/"+accountDir+"/create_request.json", virtfs.Handler{
			Stat: func(ctx context.Context, req virtfs.Request) (*vfs.Node, error) {
				consumed, err := accounts.BootstrapConsumed(ctx, connection)
				if err != nil {
					return nil, err
				}
				if consumed {
					return nil, os.ErrNotExist
				}
				return virtfs.FileNode("create_request.json", 0), nil
			},
			OpenFile: func(ctx context.Context, req virtfs.Request, flags int) (vfs.File, error) {
				if wantsWrite(flags) {
					return virtfs.NewBufferedWriteFile("create_request.json", func(data []byte) error {
						return writeCreateRequest(ctx, data)
					}), nil
				}
				return readCreateRequest(ctx)
			},
		}).
		GeneratedFile("/"+accountDir+"/info.json", func(ctx context.Context, req virtfs.Request) ([]byte, error) {
			return accountInfoJSON(ctx, func(ctx context.Context) (*AccountInfo, error) {
				return accounts.InfoForConnection(ctx, connection)
			})
		})
}

type CreateRequest struct {
	Done       bool   `json:"done"`
	SubjectKey string `json:"subject_key"`
	Secret     string `json:"secret"`
}

func newCreateRequestJSON() ([]byte, error) {
	subjectKey, err := NewSubjectKey()
	if err != nil {
		return nil, err
	}
	secret, err := NewSecret()
	if err != nil {
		return nil, err
	}

	payload := CreateRequest{
		Done:       false,
		SubjectKey: subjectKey,
		Secret:     secret,
	}
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return nil, err
	}
	return append(data, '\n'), nil
}

func parseCreateRequest(data []byte) (CreateRequest, error) {
	var payload CreateRequest
	if err := json.Unmarshal(data, &payload); err != nil {
		return CreateRequest{}, fmt.Errorf("%w: invalid create_request.json: %v", os.ErrInvalid, err)
	}
	payload.SubjectKey = strings.TrimSpace(payload.SubjectKey)
	payload.Secret = strings.TrimSpace(payload.Secret)
	return payload, nil
}

func accountControlFS(readInfo accountInfoReader, readStats accountStatsReader) *sdk.Provider {
	tree := sdk.New()
	account := sdk.Directory(tree.Root(), accountDir).Hidden()
	sdk.JSON(account, "info.json", func(ctx context.Context, req sdk.Request, _ sdk.Unit) (*AccountInfo, error) { return readInfo(ctx) })
	sdk.JSON(account, "stats.json", func(ctx context.Context, req sdk.Request, _ sdk.Unit) (*AccountStats, error) { return readStats(ctx) })
	fs, err := tree.Build()
	if err != nil {
		panic(err)
	} // constant resource declaration
	return fs
}

func accountInfoJSON(ctx context.Context, readInfo accountInfoReader) ([]byte, error) {
	info, err := readInfo(ctx)
	if err != nil {
		return nil, err
	}
	data, err := json.MarshalIndent(info, "", "  ")
	if err != nil {
		return nil, err
	}
	return append(data, '\n'), nil
}

func cleanPath(resourcePath string) string {
	if resourcePath == "" || resourcePath == "." {
		return "/"
	}
	return path.Clean("/" + resourcePath)
}

func wantsWrite(flags int) bool {
	return flags&(os.O_WRONLY|os.O_RDWR|os.O_APPEND|os.O_TRUNC|os.O_CREATE) != 0
}
