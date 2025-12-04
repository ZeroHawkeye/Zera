package cli

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var (
	// 版本信息
	versionInfo = struct {
		Version string
		Commit  string
		Date    string
	}{
		Version: "dev",
		Commit:  "none",
		Date:    "unknown",
	}

	// 全局配置
	verbose bool
)

// SetVersionInfo 设置版本信息
func SetVersionInfo(version, commit, date string) {
	versionInfo.Version = version
	versionInfo.Commit = commit
	versionInfo.Date = date
}

// rootCmd 根命令
var rootCmd = &cobra.Command{
	Use:   "zera",
	Short: "Zera CLI - 项目开发工具",
	Long: `Zera CLI 是一个用于开发和管理 Zera 项目的命令行工具。

功能包括:
  - 并行运行前端和后端开发服务器
  - 代码生成（TODO）
  - 项目构建和部署（TODO）

使用 "zera [command] --help" 获取更多关于命令的信息。`,
	SilenceUsage:  true,
	SilenceErrors: true,
}

// Execute 执行 CLI
func Execute() error {
	return rootCmd.Execute()
}

func init() {
	// 全局 flags
	rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "显示详细输出")

	// 添加子命令
	rootCmd.AddCommand(devCmd)
	rootCmd.AddCommand(versionCmd)
}

// checkError 检查错误并打印
func checkError(err error) {
	if err != nil {
		fmt.Fprintf(os.Stderr, "错误: %v\n", err)
		os.Exit(1)
	}
}

