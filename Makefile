APP_NAME=app
SRC=$(wildcard *.go)
BIN_PATH=bin/
DB_PATH=data/db/
MAIN_DIR=cmd/


all: build

build:
	@echo "Building..."
	GOOS=linux GOARCH=amd64 go build -o $(BIN_PATH)$(APP_NAME) $(SRC)

run:
	@echo "Running server..."
	go run $(MAIN_DIR)server/*.go

clean:
	@echo "Cleaning..."
	rm -f $(BIN_PATH)$(APP_NAME)
	rm -f $(DB_PATH)data.db

fmt:
	@echo "Formatting..."
	go fmt ./...

deps:
	@echo "Installing dependencies..."
	go get github.com/gorilla/mux
	go get github.com/mattn/go-sqlite3
	go get github.com/dgrijalva/jwt-go
	go get golang.org/x/crypto/bcrypt

initdb:
	@echo "Initializing SQLite DB..."
	@touch $(DB_PATH)data.db
	go run *.go & sleep 1 && kill $$!

zip:
	@echo "Packaging project..."
	zip -r project.zip . -x "project.zip"
