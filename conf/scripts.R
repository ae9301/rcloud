## this is a hack for now - will move to rcloud.support once we see that it works

rcloud.support:::configure.rcloud("startup")

.GlobalEnv$oc.init <- function(...) {
    ## remove myself from the global env since my job is done
    if (identical(.GlobalEnv$oc.init, oc.init)) rm(oc.init, envir=.GlobalEnv)

    Rserve:::ocap(call.script, "call.script")
}

URIparse <- function(o) {
    if (is.raw(o)) o <- rawToChar(o)
    body <- strsplit(o, "&", TRUE)[[1]]
    vals <- gsub("[^=]+=", "", body)
    if (length(vals)) vals <- sapply(vals, URLdecode)
    keys <- gsub("=.*$", "", body)
    names(vals) <- keys
    vals    
}

## to simplify the marshalling, we use packed raw vector which has
## NUL-separated strings containing url, query, headers followed
## by binary body. The parsing here is very hacky, it woudl be better
## done in C, in particular since we already have the code in http.c
call.script <- function(packed) {
    w <- which(packed == as.raw(0L))[1:3]
    url <- rawToChar(packed[1L : (w[1L] - 1L)])
    query <- if (w[2L] > w[1L] + 1L) rawToChar(packed[(w[1L] + 1L):(w[2L] - 1L)]) else character()
    headers <- if (w[3L] > w[2L] + 1L) packed[(w[2L] + 1L):(w[3L] - 1L)] else raw()
    body <- if (w[3L] < length(packed)) packed[(w[3L] + 1L):length(packed)] else NULL
    cat("### request:\n")
    str(list(url, query, body, headers))
    hs <- rawToChar(headers)
    if (length(grep("Content-Type: application/x-www-form-urlencoded", hs, TRUE)))
        body <- URIparse(body)
    if (length(query))
        query <- URIparse(query)
    res <- rcloud.support:::.http.request(url, query, body, headers)
    cat("--- result:\n");
    str(res)
    res
}

rcloud.support:::setConf("http.user", NULL)
