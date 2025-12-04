package cli

import (
	"fmt"
	"runtime"

	"github.com/spf13/cobra"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "显示版本信息",
	Long:  "显示 Zera CLI 的版本信息，包括版本号、Git 提交哈希和构建时间。",
	Run: func(cmd *cobra.Command, args []string) {
		fmt.Printf("Zera CLI\n")
		fmt.Printf("  版本:    %s\n", versionInfo.Version)
		fmt.Printf("  提交:    %s\n", versionInfo.Commit)
		fmt.Printf("  构建时间: %s\n", versionInfo.Date)
		fmt.Printf("  Go 版本: %s\n", runtime.Version())
		fmt.Printf("  平台:    %s/%s\n", runtime.GOOS, runtime.GOARCH)
	},
}

