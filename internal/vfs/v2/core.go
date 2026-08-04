package v2

type VFS struct {
    ScopeResolver      ScopeResolver
    ConnectionResolver ConnectionResolver
    ProviderRegistry   ProviderRegistry
    Authorizer         Authorizer
}