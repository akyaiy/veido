package app

import (
	"database/sql"
	"log"
	"net/http"
	"time"

	"github.com/akyaiy/veido/api/handlers/HTML"
	"github.com/akyaiy/veido/api/handlers/aclH"
	"github.com/akyaiy/veido/api/handlers/files_api"
	"github.com/akyaiy/veido/api/handlers/functions"
	"github.com/akyaiy/veido/api/handlers/webdavh"

	authMiddleware "github.com/akyaiy/veido/api/middleware"

	"github.com/akyaiy/veido/internal/acl"
	"github.com/akyaiy/veido/internal/auth"
	"github.com/akyaiy/veido/internal/config"
	"github.com/akyaiy/veido/internal/files"
	"github.com/akyaiy/veido/internal/shared"
	"github.com/akyaiy/veido/internal/vfs"
	"github.com/akyaiy/veido/internal/vfs/adapters/webdav"
	"github.com/akyaiy/veido/internal/vfs/providers"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
)

func ServerStart(db *sql.DB, aut *auth.Auth) {
	v2api, err := newV2Runtime(db, aut)
	if err != nil {
		log.Fatalf("configure VFSv2 runtime: %v", err)
	}

	files.BaseDir = "."
	// 1. Регистрация кастомных WebDAV методов в chi
	// Это позволяет роутеру распознавать эти методы в запросах
	chi.RegisterMethod("PROPFIND")
	chi.RegisterMethod("PROPPATCH")
	chi.RegisterMethod("MKCOL")
	chi.RegisterMethod("COPY")
	chi.RegisterMethod("MOVE")
	chi.RegisterMethod("LOCK")
	chi.RegisterMethod("UNLOCK")

	r := chi.NewRouter()
	// --- MIDDLEWARE ---
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(authMiddleware.AuthMiddleware(aut))
	r.Use(middleware.Timeout(config.GetSTimeoutTime()))
	// -----------------------------
	//              API
	// -----------------------------
	// 2. Настройка WebDAV обработчика
	storage := vfs.NewLocalStorageDriver(config.Data.CASdir)
	localVFSprovider := vfs.NewLocalFSProvider(db, storage)
	mountManager := providers.NewMountManagerFSProvider(db, localVFSprovider)
	accessSystem := vfs.NewACLAccessSystem(db)
	fileManager := vfs.NewFSManager(mountManager, accessSystem)
	localLockSystem := vfs.NewDBLockSystem(db)

	webdavAdapter := webdav.NewWebDAVAdapter(fileManager)
	lockSystem := webdav.NewWebDAVLockSystem(localLockSystem)

	r.Route("/webdav", func(r chi.Router) {
		r.Handle("/*", acl.RequirePermission(
			db, acl.FilesPermissionFromRequestWebDav, webdavh.WebDAVHandler(webdavAdapter, lockSystem)))
	})

	sharedManager := shared.SharedOPs{
		Db:            db,
		AccessControl: accessSystem,
	}

	filesApiHandler := files_api.NewFileHandler(*fileManager, mountManager, &sharedManager, aut)

	r.Route("/api", func(api chi.Router) {
		api.Route("/v2/vfs", v2api.Register)
		api.Get("/protected", HTML.LoadProtected(aut))
		api.Route("/HTML", func(u chi.Router) { HTML.RegisterRoutes(u, db, aut) })
		api.Route("/functions", func(u chi.Router) { functions.RegisterRoutes(u, db, aut) })
		api.Route("/files", func(u chi.Router) { files_api.RegisterRoutes(r, filesApiHandler) })
		api.Route("/acl-admin", func(u chi.Router) { aclH.RegisterRoutes(u, db, aut) })
	})
	// Отдаём статику
	fs := http.StripPrefix("/static/", http.FileServer(http.Dir(config.Data.StaticDir)))
	r.Handle("/static/*", fs)
	// Фронтенд работает как SPA: любые не-API запросы → index.html
	r.Get("/*", HTML.LoadTemplatePage)
	srv := &http.Server{
		Addr:    config.Data.Port,
		Handler: r,
		WriteTimeout: func() time.Duration {
			d, err := config.GetTimeField("STimeoutTime")
			if err != nil {
				log.Println("Ошибка:", err)
			}
			return d
		}(),
		ReadTimeout: func() time.Duration {
			d, err := config.GetTimeField("STimeoutTime")
			if err != nil {
				log.Println("Ошибка:", err)
			}
			return d
		}(),
	}

	log.Printf("Server started at http://localhost%s", config.Data.Port)
	log.Fatal(srv.ListenAndServe())
}
