package cli

import (
	"context"
	"fmt"
	"io"
	"net"
	"os"
	"os/exec"
	"os/signal"
	"path/filepath"
	"sync"
	"time"

	tea "github.com/charmbracelet/bubbletea"
	"github.com/spf13/cobra"
)

// serviceRunner 管理单个服务的运行
type serviceRunner struct {
	name       string
	service    Tab
	cmd        *exec.Cmd
	cancelFunc context.CancelFunc
	running    bool
	mu         sync.Mutex
}

var (
	// dev 命令配置
	devFrontendOnly bool
	devBackendOnly  bool
	devProjectRoot  string
	devNoTUI        bool // 禁用 TUI 模式
)

// devCmd dev 命令
var devCmd = &cobra.Command{
	Use:   "dev",
	Short: "启动开发服务器",
	Long: `启动前端和后端开发服务器。

默认情况下会并行启动前端 (bun run dev) 和后端 (go run ./cmd/server)。

功能:
  - Tab 切换: 查看 All/Frontend/Backend 日志
  - Vim 风格导航: j/k 上下滚动, h/l 左右切换 Tab
  - 复制模式: 按 'c' 切换纯文本模式，方便复制

快捷键:
  Tab/1-3    切换 Tab (All/Frontend/Backend)
  h/l/←/→    左右切换 Tab
  j/k/↑/↓    上下滚动
  d/u        半页滚动
  g/G        跳到顶部/底部
  a          切换自动滚动
  r          重启当前 Tab 对应的服务
  c          切换复制模式（纯文本，无边框）
  C          清空当前 Tab 日志
  ?          显示帮助
  q          退出

示例:
  zera dev              # 启动前端和后端 (TUI 模式)
  zera dev --no-tui     # 启动前端和后端 (传统模式)
  zera dev --frontend   # 仅启动前端
  zera dev --backend    # 仅启动后端
  zera dev --root /path/to/project  # 指定项目根目录`,
	RunE: runDev,
}

func init() {
	devCmd.Flags().BoolVarP(&devFrontendOnly, "frontend", "f", false, "仅启动前端开发服务器")
	devCmd.Flags().BoolVarP(&devBackendOnly, "backend", "b", false, "仅启动后端开发服务器")
	devCmd.Flags().StringVarP(&devProjectRoot, "root", "r", "", "项目根目录 (默认: 当前目录或自动检测)")
	devCmd.Flags().BoolVar(&devNoTUI, "no-tui", false, "禁用 TUI 模式，使用传统流式输出")
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

	// 根据模式选择运行方式
	if devNoTUI {
		return runDevLegacy(root)
	}
	return runDevTUI(root)
}

// devServiceManager 管理所有开发服务
type devServiceManager struct {
	tui            *DevTUI
	root           string
	frontendRunner *serviceRunner
	backendRunner  *serviceRunner
	mainCtx        context.Context
	mainCancel     context.CancelFunc
	mu             sync.Mutex
}

// newDevServiceManager 创建服务管理器
func newDevServiceManager(root string, tui *DevTUI) *devServiceManager {
	ctx, cancel := context.WithCancel(context.Background())
	return &devServiceManager{
		tui:        tui,
		root:       root,
		mainCtx:    ctx,
		mainCancel: cancel,
		frontendRunner: &serviceRunner{
			name:    "frontend",
			service: TabFrontend,
		},
		backendRunner: &serviceRunner{
			name:    "backend",
			service: TabBackend,
		},
	}
}

// startFrontend 启动前端服务
func (m *devServiceManager) startFrontend() {
	m.frontendRunner.mu.Lock()
	if m.frontendRunner.running {
		m.frontendRunner.mu.Unlock()
		return
	}
	m.frontendRunner.mu.Unlock()

	go func() {
		m.tui.SendStatus(TabFrontend, StatusStarting, nil)
		err := m.runFrontendService()
		if err != nil && m.mainCtx.Err() == nil {
			m.tui.SendStatus(TabFrontend, StatusFailed, err)
		} else if m.mainCtx.Err() == nil {
			// 进程正常退出但不是因为主上下文取消，也视为失败
			m.tui.SendStatus(TabFrontend, StatusFailed, fmt.Errorf("进程异常退出"))
		}
	}()
}

// startBackend 启动后端服务
func (m *devServiceManager) startBackend() {
	m.backendRunner.mu.Lock()
	if m.backendRunner.running {
		m.backendRunner.mu.Unlock()
		return
	}
	m.backendRunner.mu.Unlock()

	go func() {
		m.tui.SendStatus(TabBackend, StatusStarting, nil)
		err := m.runBackendService()
		if err != nil && m.mainCtx.Err() == nil {
			m.tui.SendStatus(TabBackend, StatusFailed, err)
		} else if m.mainCtx.Err() == nil {
			// 进程正常退出但不是因为主上下文取消，也视为失败
			m.tui.SendStatus(TabBackend, StatusFailed, fmt.Errorf("进程异常退出"))
		}
	}()
}

// stopFrontend 停止前端服务
func (m *devServiceManager) stopFrontend() {
	m.frontendRunner.mu.Lock()

	if m.frontendRunner.cancelFunc != nil {
		m.frontendRunner.cancelFunc()
		m.frontendRunner.cancelFunc = nil
	}

	cmd := m.frontendRunner.cmd
	m.frontendRunner.mu.Unlock()

	if cmd != nil && cmd.Process != nil {
		killProcessTree(cmd)
		// 等待进程退出，最多等待 3 秒
		done := make(chan struct{})
		go func() {
			cmd.Wait()
			close(done)
		}()

		select {
		case <-done:
			// 进程已退出
		case <-time.After(3 * time.Second):
			// 超时，强制终止
			if cmd.Process != nil {
				cmd.Process.Kill()
			}
		}
	}

	m.frontendRunner.mu.Lock()
	m.frontendRunner.running = false
	m.frontendRunner.cmd = nil
	m.frontendRunner.mu.Unlock()
}

// stopBackend 停止后端服务
func (m *devServiceManager) stopBackend() {
	m.backendRunner.mu.Lock()

	if m.backendRunner.cancelFunc != nil {
		m.backendRunner.cancelFunc()
		m.backendRunner.cancelFunc = nil
	}

	cmd := m.backendRunner.cmd
	m.backendRunner.mu.Unlock()

	if cmd != nil && cmd.Process != nil {
		killProcessTree(cmd)
		// 等待进程退出，最多等待 3 秒
		done := make(chan struct{})
		go func() {
			cmd.Wait()
			close(done)
		}()

		select {
		case <-done:
			// 进程已退出
		case <-time.After(3 * time.Second):
			// 超时，强制终止
			if cmd.Process != nil {
				cmd.Process.Kill()
			}
		}
	}

	m.backendRunner.mu.Lock()
	m.backendRunner.running = false
	m.backendRunner.cmd = nil
	m.backendRunner.mu.Unlock()
}

// restartService 重启指定服务
func (m *devServiceManager) restartService(service Tab) {
	// 默认后端端口，用于检查端口释放
	const backendPort = 9800

	switch service {
	case TabAll:
		m.stopFrontend()
		m.stopBackend()
		// 等待后端端口释放
		m.tui.SendLog(TabBackend, "⏳ 等待端口释放...")
		if !waitForPortRelease(backendPort, 5*time.Second) {
			m.tui.SendLog(TabBackend, "⚠️ 端口释放超时，尝试继续启动...")
		}
		m.startFrontend()
		m.startBackend()
	case TabFrontend:
		m.stopFrontend()
		// 前端不需要特定端口检查，等待一小段时间即可
		time.Sleep(500 * time.Millisecond)
		m.startFrontend()
	case TabBackend:
		m.stopBackend()
		// 等待后端端口释放
		m.tui.SendLog(TabBackend, "⏳ 等待端口释放...")
		if !waitForPortRelease(backendPort, 5*time.Second) {
			m.tui.SendLog(TabBackend, "⚠️ 端口释放超时，尝试继续启动...")
		}
		m.startBackend()
	}
}

// stopAll 停止所有服务
func (m *devServiceManager) stopAll() {
	m.mainCancel()

	// 并行停止所有服务
	var wg sync.WaitGroup
	wg.Add(2)

	go func() {
		defer wg.Done()
		m.stopFrontend()
	}()

	go func() {
		defer wg.Done()
		m.stopBackend()
	}()

	// 等待所有服务停止
	wg.Wait()
}

// runFrontendService 运行前端服务（内部方法）
func (m *devServiceManager) runFrontendService() error {
	frontendDir := filepath.Join(m.root, "frontend")

	m.tui.SendLog(TabFrontend, "🚀 启动前端开发服务器...")
	m.tui.SendLog(TabFrontend, fmt.Sprintf("   目录: %s", frontendDir))
	m.tui.SendLog(TabFrontend, "   命令: bun run dev")

	// 检测 bun 是否可用
	bunPath, err := exec.LookPath("bun")
	if err != nil {
		return fmt.Errorf("未找到 bun，请先安装 bun: https://bun.sh")
	}

	// 创建独立的上下文
	ctx, cancel := context.WithCancel(m.mainCtx)

	cmd := exec.CommandContext(ctx, bunPath, "run", "dev")
	cmd.Dir = frontendDir
	cmd.Env = os.Environ()

	// 设置进程属性，确保子进程在同一进程组中
	setProcAttr(cmd)

	// 设置输出
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return err
	}

	if err := cmd.Start(); err != nil {
		cancel()
		return err
	}

	// 更新 runner 状态
	m.frontendRunner.mu.Lock()
	m.frontendRunner.cmd = cmd
	m.frontendRunner.cancelFunc = cancel
	m.frontendRunner.running = true
	m.frontendRunner.mu.Unlock()

	// 发送运行状态
	m.tui.SendStatus(TabFrontend, StatusRunning, nil)

	// 并行读取输出到 TUI
	go streamToTUI(stdout, m.tui, TabFrontend)
	go streamToTUI(stderr, m.tui, TabFrontend)

	err = cmd.Wait()

	// 更新 runner 状态
	m.frontendRunner.mu.Lock()
	m.frontendRunner.running = false
	m.frontendRunner.mu.Unlock()

	if ctx.Err() != nil {
		m.tui.SendStatus(TabFrontend, StatusStopped, nil)
		return nil // 正常取消
	}
	return err
}

// runBackendService 运行后端服务（内部方法）
func (m *devServiceManager) runBackendService() error {
	backendDir := filepath.Join(m.root, "backend")

	m.tui.SendLog(TabBackend, "🚀 启动后端开发服务器...")
	m.tui.SendLog(TabBackend, fmt.Sprintf("   目录: %s", backendDir))
	m.tui.SendLog(TabBackend, "   命令: go run ./cmd/server")

	// 检测 go 是否可用
	goPath, err := exec.LookPath("go")
	if err != nil {
		return fmt.Errorf("未找到 go，请先安装 Go: https://go.dev")
	}

	// 创建独立的上下文
	ctx, cancel := context.WithCancel(m.mainCtx)

	cmd := exec.CommandContext(ctx, goPath, "run", "./cmd/server")
	cmd.Dir = backendDir
	cmd.Env = os.Environ()

	// 设置进程属性，确保子进程在同一进程组中
	setProcAttr(cmd)

	// 设置输出
	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return err
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return err
	}

	if err := cmd.Start(); err != nil {
		cancel()
		return err
	}

	// 更新 runner 状态
	m.backendRunner.mu.Lock()
	m.backendRunner.cmd = cmd
	m.backendRunner.cancelFunc = cancel
	m.backendRunner.running = true
	m.backendRunner.mu.Unlock()

	// 发送运行状态
	m.tui.SendStatus(TabBackend, StatusRunning, nil)

	// 并行读取输出到 TUI
	go streamToTUI(stdout, m.tui, TabBackend)
	go streamToTUI(stderr, m.tui, TabBackend)

	err = cmd.Wait()

	// 更新 runner 状态
	m.backendRunner.mu.Lock()
	m.backendRunner.running = false
	m.backendRunner.mu.Unlock()

	if ctx.Err() != nil {
		m.tui.SendStatus(TabBackend, StatusStopped, nil)
		return nil // 正常取消
	}
	return err
}

// killProcessTree 杀死进程树
// 使用平台特定的方式杀死整个进程组
func killProcessTree(cmd *exec.Cmd) {
	if cmd == nil || cmd.Process == nil {
		return
	}

	// 使用平台特定的进程组杀死方法
	if err := killProcessGroup(cmd); err != nil {
		// 如果进程组杀死失败，回退到直接杀死进程
		if cmd.Process != nil {
			cmd.Process.Kill()
		}
	}
}

// isPortAvailable 检查端口是否可用
func isPortAvailable(port int) bool {
	addr := fmt.Sprintf(":%d", port)
	ln, err := net.Listen("tcp", addr)
	if err != nil {
		return false
	}
	ln.Close()
	return true
}

// waitForPortRelease 等待端口释放，最多等待指定时间
func waitForPortRelease(port int, maxWait time.Duration) bool {
	deadline := time.Now().Add(maxWait)
	for time.Now().Before(deadline) {
		if isPortAvailable(port) {
			return true
		}
		time.Sleep(100 * time.Millisecond)
	}
	return false
}

// runDevTUI 使用 TUI 模式运行
func runDevTUI(root string) error {
	// 创建 TUI 模型
	tui := NewDevTUI()

	// 创建服务管理器
	manager := newDevServiceManager(root, tui)

	// 设置重启回调
	tui.SetRestartCallback(func(service Tab) {
		manager.restartService(service)
	})

	// 启动服务
	if !devBackendOnly {
		manager.startFrontend()
	}
	if !devFrontendOnly {
		manager.startBackend()
	}

	// 启动 TUI
	p := tea.NewProgram(
		tui,
		tea.WithAltScreen(),       // 使用备用屏幕
		tea.WithMouseCellMotion(), // 支持鼠标滚动
	)

	// 运行 TUI（阻塞直到退出）
	if _, err := p.Run(); err != nil {
		manager.stopAll()
		return fmt.Errorf("TUI 错误: %w", err)
	}

	// 停止所有服务
	manager.stopAll()

	fmt.Println("👋 开发服务已停止")
	return nil
}

// runDevLegacy 使用传统模式运行（无 TUI）
func runDevLegacy(root string) error {
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

// streamToTUI 流式读取输出并发送到 TUI
func streamToTUI(r io.Reader, tui *DevTUI, source Tab) {
	buf := make([]byte, 4096)
	var lineBuffer string

	for {
		n, err := r.Read(buf)
		if n > 0 {
			lineBuffer += string(buf[:n])

			// 按行发送
			for {
				idx := -1
				for i := 0; i < len(lineBuffer); i++ {
					if lineBuffer[i] == '\n' {
						idx = i
						break
					}
				}

				if idx == -1 {
					break
				}

				line := lineBuffer[:idx]
				lineBuffer = lineBuffer[idx+1:]

				if line != "" {
					tui.SendLog(source, line)
				}
			}
		}
		if err != nil {
			// 发送剩余内容
			if lineBuffer != "" {
				tui.SendLog(source, lineBuffer)
			}
			break
		}
	}
}

// runFrontend 运行前端开发服务器（传统模式）
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

	// 设置进程属性，确保子进程在同一进程组中
	setProcAttr(cmd)

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

// runBackend 运行后端开发服务器（传统模式）
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

	// 设置进程属性，确保子进程在同一进程组中
	setProcAttr(cmd)

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
