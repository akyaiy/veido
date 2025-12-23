package webdavh

// func RegisterRoutes(r chi.Router, db *sql.DB, aut *auth.Auth) {
// 	// Всё, что начинается с /api/dav/ отдаём в стандартный http.Handler
// 	r.Mount("/api/dav", http.StripPrefix("/api/dav", acl.RequirePermission(db, aut, "dav.*", WebDAVHandler(db))))

// 	// handler := acl.RequirePermission(db, aut, "dav.*", WebDAVHandler(db))

// 	// // Ловим сам корень и все подкаталоги
// 	// r.Handle("/api/dav", handler)   // /api/dav
// 	// r.Handle("/api/dav/*", handler) // /api/dav/anything
// }
