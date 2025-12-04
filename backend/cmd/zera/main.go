package main

import (
	"os"

	"zera/internal/cli"
)

// 版本信息，通过 ldflags 注入
var (
	version = "dev"
	commit  = "none"
	date    = "unknown"
)

func main() {
	cli.SetVersionInfo(version, commit, date)

	if err := cli.Execute(); err != nil {
		os.Exit(1)
	}
}
