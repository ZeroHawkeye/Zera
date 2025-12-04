package cli

import (
	"context"
	"fmt"
	"io"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"runtime"
	"sync"

	"github.com/spf13/cobra"
)

var (
	// dev 命令配置
	devFrontendOnly bool
	devBackendOnly  bool
	devProjectRoot  string
)

// devCmd dev 命令
var devCmd = &cobra.Command{
	Use:   "dev",
	Short: "启动开发服务器",
	Long: `启动前端和后端开发服务器。

默认情况下会并行启动前端 (bun run dev) 和后端 (go run ./cmd/server)。

示例:
  zera dev              # 启动前端和后端
  zera dev --frontend   # 仅启动前端
  zera dev --backend    # 仅启动后端
  zera dev --root /path/to/project  # 指定项目根目录`,
	RunE: runDev,
}

func init() {
	devCmd.Flags().BoolVarP(&devFrontendOnly, "frontend", "f", false, "仅启动前端开发服务器")
	devCmd.Flags().BoolVarP(&devBackendOnly, "backend", "b", false, "仅启动后端开发服务器")
	devCmd.Flags().StringVarP(&devProjectRoot, "root", "r", "", "项目根目录 (默认: 当前目录或自动检测)")
}

// runDev 运行开发服务器
func runDev(cmd *cobra.Command, args []string) error {
	// 检测项目根目录
	root, err := detectProjectRoot()
	if err != nil {
		return fmt.Errorf("无法检测项目根目录: %w", err)
	}

	if verbose {
		fmt.Printf("📁 项目根目录: %s\n", root)
	}

	// 创建上下文，支持优雅关闭
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 捕获中断信号
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, os.Interrupt)
	go func() {
		<-sigCh
		fmt.Println("\n⏹️  正在停止服务...")
		cancel()
	}()

	var wg sync.WaitGroup
	errCh := make(chan error, 2)

	// 启动前端
	if !devBackendOnly {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := runFrontend(ctx, root); err != nil && ctx.Err() == nil {
				errCh <- fmt.Errorf("前端错误: %w", err)
			}
		}()
	}

	// 启动后端
	if !devFrontendOnly {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := runBackend(ctx, root); err != nil && ctx.Err() == nil {
				errCh <- fmt.Errorf("后端错误: %w", err)
			}
		}()
	}

	// 等待所有服务完成或出错
	doneCh := make(chan struct{})
	go func() {
		wg.Wait()
		close(doneCh)
	}()

	select {
	case err := <-errCh:
		cancel()
		return err
	case <-doneCh:
		return nil
	}
}

// detectProjectRoot 检测项目根目录
func detectProjectRoot() (string, error) {
	// 如果指定了根目录，使用指定的
	if devProjectRoot != "" {
		abs, err := filepath.Abs(devProjectRoot)
		if err != nil {
			return "", err
		}
		if !isValidProjectRoot(abs) {
			return "", fmt.Errorf("指定的目录不是有效的 Zera 项目: %s", abs)
		}
		return abs, nil
	}

	// 从当前目录向上查找
	cwd, err := os.Getwd()
	if err != nil {
		return "", err
	}

	dir := cwd
	for {
		if isValidProjectRoot(dir) {
			return dir, nil
		}

		parent := filepath.Dir(dir)
		if parent == dir {
			break
		}
		dir = parent
	}

	// 检查当前目录是否是子目录（frontend 或 backend）
	if filepath.Base(cwd) == "frontend" || filepath.Base(cwd) == "backend" {
		parent := filepath.Dir(cwd)
		if isValidProjectRoot(parent) {
			return parent, nil
		}
	}

	return "", fmt.Errorf("无法找到 Zera 项目根目录，请使用 --root 指定")
}

// isValidProjectRoot 检查是否是有效的项目根目录
func isValidProjectRoot(dir string) bool {
	// 检查必要的目录和文件
	checks := []string{
		filepath.Join(dir, "frontend", "package.json"),
		filepath.Join(dir, "backend", "go.mod"),
	}

	for _, check := range checks {
		if _, err := os.Stat(check); os.IsNotExist(err) {
			return false
		}
	}
	return true
}

// runFrontend 运行前端开发服务器
func runFrontend(ctx context.Context, root string) error {
	frontendDir := filepath.Join(root, "frontend")

	fmt.Println("🚀 启动前端开发服务器...")
	if verbose {
		fmt.Printf("   目录: %s\n", frontendDir)
		fmt.Println("   命令: bun run dev")
	}

	// 检测 bun 是否可用
	bunPath, err := exec.LookPath("bun")
	if err != nil {
		return fmt.Errorf("未找到 bun，请先安装 bun: https://bun.sh")
	}

	cmd := exec.CommandContext(ctx, bunPath, "run", "dev")
	cmd.Dir = frontendDir
	cmd.Env = os.Environ()

	// 设置输出
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	// 并行读取输出
	go prefixedCopy(os.Stdout, stdout, "\033[36m[frontend]\033[0m ")
	go prefixedCopy(os.Stderr, stderr, "\033[36m[frontend]\033[0m ")

	err = cmd.Wait()
	if ctx.Err() != nil {
		return nil // 正常取消
	}
	return err
}

// runBackend 运行后端开发服务器
func runBackend(ctx context.Context, root string) error {
	backendDir := filepath.Join(root, "backend")

	fmt.Println("🚀 启动后端开发服务器...")
	if verbose {
		fmt.Printf("   目录: %s\n", backendDir)
		fmt.Println("   命令: go run ./cmd/server")
	}

	// 检测 go 是否可用
	goPath, err := exec.LookPath("go")
	if err != nil {
		return fmt.Errorf("未找到 go，请先安装 Go: https://go.dev")
	}

	cmd := exec.CommandContext(ctx, goPath, "run", "./cmd/server")
	cmd.Dir = backendDir
	cmd.Env = os.Environ()

	// 设置输出
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		return err
	}

	if err := cmd.Start(); err != nil {
		return err
	}

	// 并行读取输出
	go prefixedCopy(os.Stdout, stdout, "\033[33m[backend]\033[0m  ")
	go prefixedCopy(os.Stderr, stderr, "\033[33m[backend]\033[0m  ")

	err = cmd.Wait()
	if ctx.Err() != nil {
		return nil // 正常取消
	}
	return err
}

// prefixedCopy 带前缀的输出复制
func prefixedCopy(dst io.Writer, src io.Reader, prefix string) {
	buf := make([]byte, 4096)
	lineStart := true

	for {
		n, err := src.Read(buf)
		if n > 0 {
			data := buf[:n]
			for i := 0; i < len(data); {
				if lineStart {
					dst.Write([]byte(prefix))
					lineStart = false
				}

				// 查找换行符
				j := i
				for j < len(data) && data[j] != '\n' {
					j++
				}

				if j < len(data) {
					// 包含换行符
					dst.Write(data[i : j+1])
					lineStart = true
					i = j + 1
				} else {
					// 没有换行符
					dst.Write(data[i:j])
					i = j
				}
			}
		}
		if err != nil {
			break
		}
	}
}

// killProcess 杀死进程及其子进程
// NOTE: 此函数目前未使用，因为我们使用 context 来管理进程生命周期
// 保留此函数以便将来可能需要手动终止进程
func killProcess(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}

	if runtime.GOOS == "windows" {
		// Windows: 使用 taskkill 杀死进程树
		exec.Command("taskkill", "/F", "/T", "/PID", fmt.Sprintf("%d", cmd.Process.Pid)).Run()
	} else {
		// Unix: 发送 SIGKILL 信号给进程
		cmd.Process.Kill()
	}
}
