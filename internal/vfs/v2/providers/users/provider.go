package users

import (
	vfs "github.com/akyaiy/veido/internal/vfs/v2"
	sdk "github.com/akyaiy/veido/pkg/vfs/providersdk"
	"context"
	"errors"
	"os"
)

type Provider struct {
	store Store
	vfs.FSProvider
}

func Definition(store Store) sdk.Definition[struct{}] {
	return sdk.Definition[struct{}]{
		Key: ProviderKey, Summary: "Actor identity and user-owned profile resources",
		Open: func(_ context.Context, _ vfs.ProviderConnection, _ struct{}) (vfs.FSProvider, error) {
			if store == nil {
				return nil, vfs.ErrInvalidNewInstanceParams
			}
			provider := &Provider{store: store}
			fs, err := provider.buildFS()
			if err != nil {
				return nil, err
			}
			provider.FSProvider = fs
			return provider, nil
		},
	}
}

func (p *Provider) buildFS() (*sdk.Provider, error) {
	tree := sdk.New()
	root := tree.Root()
	sdk.JSON(root, "actor.json", func(ctx context.Context, _ sdk.Request, _ sdk.Unit) (ActorDocument, error) {
		actor, err := sdk.Actor(ctx)
		if err != nil {
			return ActorDocument{}, err
		}
		return ActorDocument{Kind: string(actor.Kind), ID: actor.ID}, nil
	})

	me := sdk.Directory(root, "me")
	sdk.Document(me, "profile.json", sdk.DocumentSpec[sdk.Unit, ProfileUpdate]{
		Read: func(ctx context.Context, _ sdk.Request, _ sdk.Unit) (ProfileUpdate, error) {
			profile, err := p.selfProfile(ctx)
			if err != nil {
				return ProfileUpdate{}, err
			}
			return updateFromProfile(profile), nil
		},
		Replace: func(ctx context.Context, _ sdk.Request, _ sdk.Unit, update ProfileUpdate) error {
			actor, err := authenticatedActor(ctx)
			if err != nil {
				return err
			}
			_, err = p.store.Put(ctx, actor.ID, update)
			return err
		},
	})
	_, item := sdk.CollectionResources(root, "users", "userID", sdk.CollectionSpec[sdk.Unit, *Profile]{
		List: func(ctx context.Context, _ sdk.Request, _ sdk.Unit) ([]*Profile, error) {
			actor, err := authenticatedActor(ctx)
			if err != nil {
				if errors.Is(err, os.ErrPermission) {
					return []*Profile{}, nil
				}
				return nil, err
			}
			profile, err := p.profileFor(ctx, actor.ID)
			if err != nil {
				return nil, err
			}
			return []*Profile{profile}, nil
		},
		Lookup: func(ctx context.Context, _ sdk.Request, _ sdk.Unit, userID string) (*Profile, error) {
			actor, err := authenticatedActor(ctx)
			if err != nil || actor.ID != userID {
				return nil, os.ErrPermission
			}
			profile, err := p.profileFor(ctx, userID)
			return profile, err
		},
		Node: func(profile *Profile) *vfs.Node {
			return &vfs.Node{Name: profile.UserID, Kind: "user", IsDir: true, UpdatedAt: profile.UpdatedAt}
		},
	})
	sdk.Document(item, "profile.json", sdk.DocumentSpec[*Profile, ProfileUpdate]{
		Read: func(_ context.Context, _ sdk.Request, profile *Profile) (ProfileUpdate, error) {
			return updateFromProfile(profile), nil
		},
		Replace: func(ctx context.Context, _ sdk.Request, profile *Profile, update ProfileUpdate) error {
			_, err := p.store.Put(ctx, profile.UserID, update)
			return err
		},
	})

	// These resources expose user data. Credentials and sessions
	// remain owned by Auth; the Users provider exposes no credential commands.
	sdk.Directory(root, "session")
	sdk.Directory(root, "registration")
	credentials := sdk.Directory(root, "credentials")
	sdk.Directory(credentials, "self")
	return tree.Build()
}

func (p *Provider) selfProfile(ctx context.Context) (*Profile, error) {
	actor, err := authenticatedActor(ctx)
	if err != nil {
		return nil, err
	}
	return p.profileFor(ctx, actor.ID)
}

func (p *Provider) profileFor(ctx context.Context, userID string) (*Profile, error) {
	profile, err := p.store.Get(ctx, userID)
	if errors.Is(err, ErrProfileNotFound) {
		return &Profile{UserID: userID}, nil
	}
	return profile, err
}

func authenticatedActor(ctx context.Context) (vfs.Actor, error) {
	actor, err := sdk.Actor(ctx)
	if err != nil {
		return vfs.Actor{}, err
	}
	if actor.Kind != vfs.ActorUser || actor.ID == "" {
		return vfs.Actor{}, os.ErrPermission
	}
	return actor, nil
}

func updateFromProfile(profile *Profile) ProfileUpdate {
	return ProfileUpdate{DisplayName: profile.DisplayName, Locale: profile.Locale, Timezone: profile.Timezone}
}
